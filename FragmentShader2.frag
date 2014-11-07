layout(location = 0) uniform vec3 texture;

void main(){
	gl_FragColor.rgb = texture;
}