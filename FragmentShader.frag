#define FaceCount 1023

uniform vec2 iResolution;
uniform float verts[600*3];
uniform int faces[600*2];
uniform int faceCount;
uniform int faceMat[900];
uniform float Materials[6*3];


// -- CONSTANTS --//

// Lights
vec3 LPos = vec3(-15.0,-10.0,10.0);
vec3 ambientLight = vec3(0.0,0.0,0.0);

// Camera //
vec3 camPos = vec3(1.0,-13.0,5.0);
vec3 forward = normalize(vec3(0.0,1.0,0.0));
vec3 up      = normalize(vec3(0.0,0.0,1.0));
vec3 right = normalize(cross(forward, up));
//up = normalize(cross(right, forward));

// Scene


// Random float
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Floor plane
bool plane(vec3 pos, vec3 norm, vec3 ro, vec3 rd, inout vec3 hit, inout float dist)
{
	dist = dot(pos-ro, norm) / dot(rd, norm);
	
	if(dist < 0.00000001){ 
		return false;
	}
	hit = ro + dist * rd;
	return true;
}

// Implicit Sphere
vec4 sphere(vec3 ray, vec3 dir, vec3 center, float radius)
{
	// parallel light direction
	vec3 L = normalize(vec3(-1.0,-0.1,-0.2));

	//
	vec3 rc = center;
	float c = dot(rc, rc) - (radius*radius);
	float b = dot(dir, rc);
	float d = b*b - c;
	float t = -b - sqrt(abs(d));
	float st = step(0.0f, min(t,d));
	vec4 color = vec4(0);

	vec3 hit = ray + dir*vec3(t);
	vec3 N = -1.0f * normalize(vec3((hit.x - center.x)/radius, (hit.y - center.y)/radius, (hit.z - center.z)/radius));

	// Return lit sphere
	return vec4(1.0 - clamp(-1.0 + (1.0 + t)*d, 0.0, 1.0));
}

// Point lighting
float lightFace(vec3 N, vec3 Pos){

	// Light attenuation //
	float Ldist = length(LPos - Pos);
	float a = 0.01;
	float b = 0.001;
	float att = 1.0 / (1.0 + a*Ldist + b*Ldist*Ldist);
	
	return clamp(dot(N, normalize(LPos - Pos)) * att,0.0f,1.0f);
}

// Geometry
bool triangle(vec3 v0, vec3 v1, vec3 v2, vec3 ro, vec3 rd, inout vec3 hit, inout float dist, inout vec3 norm)
{
	vec3 cubePos = vec3(0.0,-3.0,7.0);
	v0 = cubePos + v0;
	v1 = cubePos + v1;
	v2 = cubePos + v2;

	vec3 edge1 = v2 - v0;
	vec3 edge2 = v1 - v0;

	vec3 pvec = cross(rd, edge2);

	float det = dot(edge1, pvec);

	if (det == 0) return false;

	float invDet = 1 / det;
	vec3 tvec = ro - v0;

	float u = dot(tvec, pvec) * invDet;

	if (u < 0 || u > 1) return false;

	vec3 qvec = cross(tvec, edge1);
	float v = dot(rd, qvec) * invDet;

	if (v < 0 || u + v > 1) return false;

	dist = dot(edge2, qvec) * invDet;
	hit = ro + rd* (dist);
	norm = vec3( edge1.y*edge2.z - edge1.z*edge2.y, edge1.z*edge2.x - edge1.x*edge2.z, edge1.x*edge2.y - edge1.y*edge2.x);
	norm = normalize(norm);

	if (dot(norm, normalize(ro)) < 0.0f){
		//norm = -1.0f * norm;
	}

	return true;
}


// Find intersecting face
int getIntersection(vec3 rayOrigin, vec3 rayDir, inout vec3 hit2, inout vec3 norm2){
	vec3 v1,v2,v3;
	vec3 minHit, minNorm;
	float minDist = 999999.0;
	int k = 0;

	vec3 hit;
	float dist;
	vec3 norm;

	int hitFaceIndex = -1;

	// For each face in faces array
	for(k=0; k<faceCount; k++){
		v1 = vec3( verts[3*faces[3*k]+0],	verts[3*faces[3*k]+1],		verts[3*faces[3*k]+2] );
		v2 = vec3( verts[3*faces[3*k+1]+0],	verts[3*faces[3*k+1]+1],	verts[3*faces[3*k+1]+2] );
		v3 = vec3( verts[3*faces[3*k+2]+0],	verts[3*faces[3*k+2]+1],	verts[3*faces[3*k+2]+2] );

		// Colision check
		if(triangle(v1, v2, v3, rayOrigin, rayDir, hit, dist, norm)){
			if(dist < minDist){
				minDist = dist;
				minHit = hit;
				minNorm = norm;
				hitFaceIndex = k;
			}
		}
	}

	hit2 = minHit;
	norm2 = minNorm;

	return hitFaceIndex;
}

vec3 getPointColor( int faceIndex ){
	
	// obj is the floor
	if (faceIndex == -1){
		return vec3(1.0,0.9,0.9);
	}

	return vec3( Materials[faceMat[faceIndex]+0], Materials[faceMat[faceIndex]+1], Materials[faceMat[faceIndex]+2] );
}

vec3 bounceRay( vec3 rayPos, vec3 rayDir){
	vec3 norm;
	vec3 hit = vec3(0.0);
	vec3 point_color = vec3(0.0);
	int objIndex;
	
	// Check ray intersection
	objIndex = getIntersection( rayPos, rayDir, hit, norm);

	// Did hit geometry
	if(objIndex != -1){
		point_color = getPointColor(objIndex) * vec3(lightFace(norm, hit));
	}

	return point_color;
}

vec3 traceRay( vec3 rayPos, vec3 rayDir, int currentBounce)
{
	int MAX_BOUNCE = 1;

	vec3 reflect_color = vec3(0.0);
	vec3 refract_color = vec3(0.0);
	vec3 bounce_color = vec3(0.0);

	vec3 point_color = vec3(0.0);
	vec3 hit, norm, minHit, minNorm,norm2;
	vec3 shadowhit;
	vec3 sum = vec3(0.0);
	float dist;

	int objIndex;
	bool hitCube = false;

	// Check ray intersection
	objIndex = getIntersection( rayPos, rayDir, hit, norm);

	// Did hit geometry
	if(objIndex != -1){
		point_color = getPointColor(objIndex) * vec3(lightFace(norm, hit));
	}

	// Hit the floor
	else if(plane( vec3(0.0), normalize(vec3(0.0,0.0,1.0)), rayPos, rayDir, hit, dist))
	{
		// Plane stuff
		float scale = 0.4;

		//do this calculation for all x, y, z, and it will work regardless of normal
		if ( mod( round( abs(hit.x)*scale) + round(abs(hit.y)*scale) + round(abs(hit.z)*scale), 2.0f) < 1.0){
			point_color = vec3(lightFace(vec3(0.0,0.0,1.0), hit));
		}	
		else{
			point_color = vec3(1.0,0.0,0.0) * lightFace(vec3(0.0,0.0,1.0), hit);
		}
	}
	
	// SHADOWS
	bool isShadow = false;
	int shadowIndex = -1;
	vec3 shadowRayDir = normalize(LPos-hit);
	vec3 shadowRayPos = hit;

	float distToLight = length(LPos - hit);

	// need a faster method, it can break the loop as soon as
    // it finds an intersection.  we dont need the closest
	shadowIndex = getIntersection( shadowRayPos, -shadowRayDir, shadowhit, norm2);

	// Hits another object
    if (shadowIndex != -1){
		
		// if the intersection is before or after the light 
		float l = length(hit - shadowhit);

		if( (l>0.0001) && (l < distToLight) ){
			isShadow = true;
		}
    }

	if (isShadow){
		point_color = point_color*0.1 + vec3(ambientLight);
	}

	bounce_color = bounceRay(hit, norm);
	point_color += bounce_color*0.1;

	return point_color;
}

void main()
{

	vec3 point_color;
	vec3 hit;
	vec3 norm;
	float dist;

	// MSAA //
	int i = 0;
	int k = 0;
	float rx = 0.0;
	float ry = 0.0;
	int samples = 1;
	float AA_amount = 0.05;

	// Geometry //
	vec4 sum = vec4(0.0f);
	
	//
	float minDist = 10000000;
	bool hitCube = false;

	// Screen info //
	const vec2 iResolution = vec2(512,512);
	vec3 screenCoords = vec3( (gl_FragCoord.xy / iResolution.xy)*2.0 - 1.0,0);

	// --
	vec3 rayOrigin = camPos + forward;
	vec3 rayDir = normalize(screenCoords.x*right + screenCoords.y*up + forward * vec3(0.95));

	// GEOMETRY
	sum.xyz = traceRay(rayOrigin, rayDir, 0);//, faces, verts, faceCount, faceMat, Materials);
	
	// Lit Sphere
	//sum += sphere( rayOrigin, rayDir, LPos, 0.001f);

	gl_FragColor = sum;
}