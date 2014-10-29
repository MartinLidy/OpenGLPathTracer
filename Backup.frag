uniform vec2 iResolution;
uniform float verts[20];
uniform float faces[20];

//__write_only image2d_t output,
//__constant float verts[],
//__constant int faces[],
//__constant int* faceCount,
//__constant int* faceMat,
//__constant float Materials[])


float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}


// -- CONSTANTS --//

// Lights
vec3 LPos =vec3(6.0,0.0,7.0);

// Camera

// Scene


// Floor plane
bool plane(vec3 pos, vec3 norm, vec3 ro, vec3 rd, inout vec3 hit, inout float dist)
{
	dist = dot(pos-ro, norm) / dot(rd, norm);
	
	if(dist < 0.0000000001){ 
		return false;
	}
	hit = ro + dist * rd;
	return true;
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

	if (dot(norm, ro) < 0.0f){
		norm = -1.0f * norm;
	}

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
	float st = step(0.0f, fmin(t,d));
	vec4 color = vec4(0);

	vec3 hit = ray + dir*vec3(t);
	vec3 N = -1.0f * normalize(vec3((hit.x - center.x)/radius, (hit.y - center.y)/radius, (hit.z - center.z)/radius));

	// Return lit sphere
	return 1.0 - clamp(-1.0 + (1.0 + t)*d, 0.0, 1.0);
}

// Reflections
vec3 reflectionFace(vec3 rayDir, vec3 N){
	float V = 0; // ?? Another missing variable
	float c1 = -dot( N, rayDir );
	vec3 Rl = vec3( V + (2 * N * c1 ) );
	return Rl;
}

// Refractions
vec3 refractionFace(vec3 rayDir, vec3 N){
	float n1 = 0.1;//index of refraction of original medium
	float n2 = 0.5;//index of refraction of new medium
	float n = n1 / n2;
	float c1 = 0; // ??? WHATS THIS
	float c2 = sqrt( 1 - n2 * (1 - c1) );

	vec3 Rr = vec3( (n * rayDir) + (n * c1 - c2) * N );
	return Rr;
}

// Point lighting
float lightFace(vec3 N, vec3 Pos){

	// Light attenuation //
	float Ldist = length(LPos - Pos);
	float a = 0.1;
	float b = 0.01;
	float att = 1.0 / (1.0 + a*Ldist + b*Ldist*Ldist);
	
	return clamp(dot(N, normalize(LPos - Pos)) * att,0.0f,1.0f);
}

// Find intersecting face
int getIntersection(vec3 rayOrigin, vec3 rayDir, inout vec3 hit2){
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

vec3 getPointColor( int objIndex, inout int faceMat, inout float Materials ){
	
	// Floor
	if (objIndex == -1){
		return vec3(1.0,0.9,0.9);
	}

	return vec3( Materials[faceMat[objIndex]+0], Materials[faceMat[objIndex]+1], Materials[faceMat[objIndex]+2] );
}

vec3 traceRay( vec3 rayPos, vec3 rayDir, inout int faces, inout float verts, inout int faceCount, inout int faceMat, inout float Materials )
{
	vec3 reflect_color = vec3(0.0);
	vec3 refract_color = vec3(0.0);
	vec3 point_color = vec3(0.0);
	vec3 hit, norm, minHit, minNorm;
	vec3 shadowhit;
	vec3 sum = vec3(0.0);
	float dist;

	int objIndex;
	bool hitCube = false;

	// Check ray intersection
	objIndex = getIntersection( rayPos, rayDir, hit, norm, faces, verts, faceCount);

	// Shadows
	bool isShadow = false;
	int shadowIndex = -1;
	vec3 shadowRayPos = hit;
	vec3 shadowRayDir = normalize(LPos - hit);

	float distToLight = length(LPos - hit);

	// Did hit geometry
	if(objIndex != -1){
    	// need a faster method, it can break the loop as soon as
    	// it finds an intersection.  we dont need the closest
		isShadow = false;
    	shadowIndex = getIntersection( shadowRayPos, shadowRayDir, shadowhit, norm, faces, verts, faceCount);

		// Hits another object
    	if	 (shadowIndex != -1) {

    		// if the intersection is before or after the light 
    		if(length(hit - shadowhit) > 1.0  length(hit - shadowhit) < (distToLight-0.1)){
        		isShadow = true;
        	}
        }
	    
	    if (!isShadow){
			point_color = getPointColor( objIndex, faceMat, Materials);
			point_color = point_color * vec3(lightFace(norm, hit));
		}else{
			point_color = vec3(0.0);
		}

	}

	// Hit the floor
	else if(plane( vec3(0.0), normalize(vec3(0.0,0.0,1.0)), rayPos, rayDir, hit, dist) )
	{
		// Plane stuff
		float scale = 0.4;

		//do this calculation for all x, y, z, and it will work regardless of normal
		if ( fmod( round( abs(hit.x)*scale) + round(abs(hit.y)*scale) + round(abs(hit.z)*scale), 2.0f) < 1.0){
			point_color = lightFace(vec3(0.0,0.0,1.0), hit);
		}	
		else{
			point_color = vec3(1.0,0.0,0.0) * lightFace(vec3(0.0,0.0,1.0), hit);
		}
	}

	/*if ( object is reflective )
		reflect_color = trace_ray( get_reflected_ray( original_ray, obj ) )
	if ( object is refractive )
		refract_color = trace_ray( get_refracted_ray( original_ray, obj ) )*/

	//return ( combine_colors( point_color, reflect_color, refract_color ));

	//if(hitCube){
	//sum = vec4(0.0,0.1,0.7,1.0) * lightFace(minNorm, minHit);

	return point_color;
}

void main(){
	vec3 screenCoords = vec3( (gl_FragCoord.xy / iResolution.xy)*2.0 - 1.0,0);

	vec3 CamOrigin = vec3(0.0,5,-20.0);
	vec3 ViewPlane = CamOrigin + vec3(-0.5,-0.5,1);

	vec3 rayDir = (ViewPlane + screenCoords) - CamOrigin;
	vec4 color = vec4(0,0,0,99999.0f);

	// MSAA
	float rx, ry;
	int i = 0;
	int samples = 10;
	float AAScale = 0.01;

	for(i=1;i<=samples;i++){
		rx = 0.5-rand( screenCoords.xy*(i) );
		ry = 0.5-rand( screenCoords.xy*(i) );

		rx = rx * AAScale;
		ry = ry * AAScale;

		//color.rgb = plane(vec3(0),rayDir,CamOrigin + vec3(rx,ry,0) ) );
		color += drawcube(vec3(-1,0,0f), vec3(1), rayDir, CamOrigin + vec3(rx,ry,0), color );
	}
	gl_FragColor.rgb = color.rgb/samples;
}

void main()
{
	// MSAA //
	int i = 0;
	int k = 0;
	float rx = 0.0;
	float ry = 0.0;
	int samples = 1;
	float AA_amount = 0.05;

	// Screen info //
	const int2 iResolution = {512,512};
    const int2 pos = {get_global_id(0), get_global_id(1)};
	float scx = ( (float)pos.x / iResolution.x )*2.0 - 1.0;
	float scy = ( (float)pos.y / iResolution.y )*-2.0 + 1.0;
	vec3 screenCoords = {scx,scy,0};

	// Camera //
	vec3 camPos = vec3(-5.0,-20.0,8.0);
	vec3 forward = normalize(vec3(0.7,1.0,0.0));
	vec3 up      = normalize(vec3(0.0,0.0,1.0));

	vec3 right = normalize(cross(forward, up));
	up = normalize(cross(right, forward));
	vec3 rayOrigin = camPos + forward;
	vec3 rayDir = normalize(scx*right + scy*up + forward * vec3(0.95));
	
	// Geometry //
	vec4 sum = vec4(0.0f);

	//
	float dist;
	float minDist = 10000000;
	bool hitCube = false;
	
	//sum.xyz = traceRay(rayOrigin, rayDir, faces, verts, faceCount, faceMat, Materials);
	
	// Lit Sphere
	sum += sphere( rayOrigin, rayDir, LPos, 0.01f);
	
    write_imagef (output, (int2)(pos.x, pos.y), sum);
	//write_imagef (output, (int2)(pos.x, pos.y), vec4(1.0,0,0,1.0));
}