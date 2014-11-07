#define FaceCount 1023
#define PI 3.14

layout(location = 0) out vec3 colorTex;

uniform vec2 iResolution;
uniform float verts[600*3];
uniform int faces[600*2];
uniform int faceCount;
uniform int faceMat[900];
uniform float Materials[6*3];
uniform int randomSeed;
uniform int sampleNumber;
uniform sampler2D lastFrame;

// -- CONSTANTS --//

// Lights
vec3 LPos = vec3(15.0,-15.0,10.0);

struct Light
{
  vec3 color;
  vec3 position;
  float radius;
  float brightness;
};

const int MAX_LIGHTS = 1;
Light L1 = Light(vec3(1.0),vec3(15.0,-15.0,10.0),0.75,1.0);
Light L2 = Light(vec3(1.0),vec3(0.0,0.0,10.0),2.0,1.0);

Light[2] LIGHTS = {L1,L2};

vec3 ambientLight = vec3(0.0,0.0,0.0);

// Camera //
float FOV = 0.95f;
vec3 camPos = vec3(1.0,-13.0,5.0);
vec3 forward = normalize(vec3(0.0,1.0,0.0));
vec3 up      = normalize(vec3(0.0,0.0,1.0));
vec3 right = normalize(cross(forward, up));


// HDR tonemapping
vec3 tonemapping(vec3 color){
	float bias = 0.1;
	float max = length(color);
	color = color/(max - bias);

	return color;
}


// Random float
float rand(vec2 co, float min, float max){
    return min + (max-min)*fract(sin(dot(co.xy*randomSeed ,vec2(12.9898,78.233))) * 43758.5453);
}

float rand2() {
	return fract(sin(randomSeed)*43758.5453123);
}

vec3 jitter(vec3 d, float phi, float sina, float cosa) {
	vec3 w = normalize(d), u = normalize(cross(w.yzx, w)), v = cross(w, u);
	return (u*cos(phi) + v*sin(phi)) * sina + w * cosa;
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

// get soft shadow Point Light location
vec3 getLightPos(int index){
	LPos = LIGHTS[index].position;//LIGHTS[index].position;
	vec3 softLPos = LPos - vec3(rand(gl_FragCoord.xy ,-LIGHTS[index].radius,LIGHTS[index].radius));
	return softLPos;
}

// Point lighting
vec3 lightFace(vec3 N, vec3 Pos){
	int i = 0;
	vec3 sum = vec3(0.0);

	// Each light
	for(i=0;i<MAX_LIGHTS;i++){
	
		vec3 softLPos = getLightPos(i);

		// Light attenuation //
		float Ldist = length(softLPos - Pos);
		float a = 0.01;
		float b = 0.001;
		float att = 1.0 / (1.0 + a*Ldist + b*Ldist*Ldist);

		sum += clamp(dot(N, normalize(softLPos - Pos)) * att,0.0f,1.0f) * LIGHTS[i].color * LIGHTS[i].brightness;
	}
	
	return sum;
}

// Geometry
bool triangle(vec3 v0, vec3 v1, vec3 v2, vec3 ro, vec3 rd, inout vec3 hit, inout float dist, inout vec3 norm)
{
	vec3 cubePos = vec3(0.0,-5.0,0.0);
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

	return vec3( Materials[3*faceMat[faceIndex]+0], Materials[3*faceMat[faceIndex]+1], Materials[3*faceMat[faceIndex]+2] );
}

vec3 bounceRay( vec3 rayPos, vec3 rayDir, int depth){
	int MAXDEPTH = 3;

	vec3 norm =  vec3(0.0);
	vec3 hit  =  vec3(0.0);
	vec3 point_color = vec3(0.0);
	int objIndex;
	
	// Recursion hack
	while(depth <= MAXDEPTH){
		depth += 1;

		// Monte carlo
		vec3 l0 = hit - LIGHTS[0].position;
		float cos_a_max = sqrt(1. - clamp(LIGHTS[0].radius * LIGHTS[0].radius / dot(l0, l0), 0., 1.));
		float cosa = mix(cos_a_max, 1., rand2());

		vec3 l = jitter(l0, 2.0*PI*rand2(), sqrt(1.0 - cosa*cosa), cosa);
		//rayDir = hit - l;
		
		// Check ray intersection
		objIndex = getIntersection( rayPos, normalize(rayDir), hit, norm);

		// Did hit geometry
		if(objIndex != -1){
			point_color += getPointColor(0) * lightFace(norm, hit) * 1.0/depth;
		}

		// cancel the iterations
		else{
			depth = MAXDEPTH + 1;
		}
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
		point_color += getPointColor(objIndex) * (lightFace(norm, hit) + ambientLight);
	}

	// Hit the floor
	else if(plane( vec3(0.0), normalize(vec3(0.0,0.0,1.0)), rayPos, rayDir, hit, dist))
	{
		norm = normalize(vec3(0.0,0.0,1.0));

		// Plane stuff
		float scale = 0.4;

		//do this calculation for all x, y, z, and it will work regardless of normal
		if ( mod( round( abs(hit.x)*scale) + round(abs(hit.y)*scale) + round(abs(hit.z)*scale), 2.0f) < 1.0){
			point_color += lightFace(vec3(0.0,0.0,1.0), hit);
		}	
		else{
			point_color =+ vec3(1.0,0.0,0.0) * lightFace(vec3(0.0,0.0,1.0), hit);
		}
	}
	
	// SHADOWS //
	int i = 0;
	
	// for each light
	for(i=0;i<MAX_LIGHTS;i++){

		vec3 softLPos = getLightPos(i);
		bool isShadow = false;
		int shadowIndex = -1;
		vec3 shadowRayDir = normalize(softLPos-hit);
		vec3 shadowRayPos = hit;

		float distToLight = length(softLPos - hit);

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

		// --
		bounce_color = bounceRay(hit, norm,0);

		if (isShadow){
			point_color = point_color*(0.1+bounce_color) + vec3(ambientLight);
		}
		point_color += bounce_color*0.2;
	}

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
	vec3 rayDir = normalize(screenCoords.x*right + screenCoords.y*up + forward * FOV);

	// GEOMETRY
	sum.xyz = traceRay(rayOrigin, rayDir, 0);
	
	// Lit Sphere
	//sum += sphere( rayOrigin, rayDir, LPos, 0.001f);

	// Save frame
	colorTex.rgb = sum.rgb;
}

//sum = (last*samples + current)/(samples+1);