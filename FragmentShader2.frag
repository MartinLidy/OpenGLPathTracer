uniform vec3 textureA;
//uniform sampler2D textureA;

void main(){
	//gl_FragColor.rgb = texture(textureA, gl_FragCoord.xy).rgb*10.0 + 0.1;
	gl_FragColor.rgb = textureA + 0.1;
}