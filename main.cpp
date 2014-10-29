#include <math.h>
#include "GLee.h"
#include <iostream>
#include <string>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <GL/gl.h>
#include <GL/glut.h>
#include "objLoader.h"
#include "obj_parser.h"
using namespace std;

GLuint   program_object;
GLuint   vertex_shader;
GLuint   fragment_shader;

//
double newtime, oldtime;
// Log information
static void printProgramInfoLog(GLuint obj)
{
	GLint infologLength = 0, charsWritten = 0;
	glGetProgramiv(obj, GL_INFO_LOG_LENGTH, &infologLength);
	if (infologLength > 2) {
		GLchar* infoLog = new GLchar [infologLength];
		glGetProgramInfoLog(obj, infologLength, &charsWritten, infoLog);
		std::cerr << infoLog << std::endl;
		delete infoLog;
	}
}

// read a file to string
std::string readFile(const char *filePath) {
	std::string content;
	std::ifstream fileStream(filePath, std::ios::in);

	if (!fileStream.is_open()) {
		std::cerr << "Could not read file " << filePath << ". File does not exist." << std::endl;
		return "";
	}

	std::string line = "";
	while (!fileStream.eof()) {
		std::getline(fileStream, line);
		content.append(line + "\n");
	}
	fileStream.close();
	return content;
}


float *VertsToFloat3(obj_vector** verts, int vertCount){
	int arraySize = vertCount * 3;
	float *output = (float*)malloc(arraySize * sizeof(float));

	// Each vert
	for (int i = 0; i < vertCount; i++){
		// Each coord
		for (int k = 0; k < 3; k++){
			//printf("%f", verts[i]->e[k]);
			output[i * 3 + k] = verts[i]->e[k];
		}
	}

	return output;
}

float *GetObjectMaterials(objLoader* object, int faceCount){
	int arraySize = object->materialCount * 3;
	float *materials = (float*)malloc(arraySize * sizeof(float));


	// Each material
	for (int i = 0; i < object->materialCount; i++){

		// Each color channel
		for (int k = 0; k < 3; k++){
			materials[i * 3 + k] = object->materialList[i]->diff[k];
			//materials[i * 3 + k] = object->materialList[object->faceList[i]->material_index]->diff[k];
		}
	}

	return materials;
}

static double* getFaceNormals(objLoader objData, int faceCount){
	/*int arraySize = objData->normalCount * 3;
	double *normals = (double*)malloc(arraySize * sizeof(double));

	for (int i = 0; i < faceCount; i++){
	for (int k = 0; k < 3; k++){
	normals[3*i + k] = objData->normalList[3 * (objData->faceList[i]->normal_index) + k];
	}
	}*/
}

int *FacesToMats(objLoader* object, int faceCount){
	int arraySize = faceCount;
	int *faceMats = (int*)malloc(arraySize * sizeof(int));

	// Each face
	for (int i = 0; i < faceCount; i++){
		faceMats[i] = 3 * object->faceList[i]->material_index;
	}

	return faceMats;
}

int *FacesToVerts(obj_face** faces, int faceCount){
	int arraySize = faceCount * 3;
	int *output = (int*)malloc(arraySize * sizeof(int));

	// Each face
	for (int i = 0; i < faceCount; i++){

		// Each vert
		for (int k = 0; k < 3; k++){
			output[i * 3 + k] = faces[i]->vertex_index[k];//printf("   Vert: %d", output[i * 3 + k]);
		}
	}

	return output;
}

objLoader * parseObj(){
	objLoader *objData = new objLoader();
	objData->load("test.obj");

	// 
	const int faceAmount = objData->faceCount;

	printf("Number of vertices: %i\n", objData->vertexCount);
	printf("Number of faces: %i\n", objData->faceCount);
	printf("Number of materials: %i\n", objData->materialCount);
	printf("\n");

	printf("Number of faces: %i\n", objData->faceCount);
	printf("Material List: %d\n", objData->materialList[objData->faceList[0]->material_index]->diff);

	return objData;
}


// Create the vertex and fragment shaders
GLuint LoadShader(const char *vertex_path, const char *fragment_path) {
	GLuint vertShader = glCreateShader(GL_VERTEX_SHADER);
	GLuint fragShader = glCreateShader(GL_FRAGMENT_SHADER);

	// Read shaders
	std::string vertShaderStr = readFile(vertex_path);
	std::string fragShaderStr = readFile(fragment_path);
	const char *vertShaderSrc = vertShaderStr.c_str();
	const char *fragShaderSrc = fragShaderStr.c_str();

	GLint result = GL_FALSE;
	int logLength;

	// Compile vertex shader
	std::cout << "Compiling vertex shader." << std::endl;
	glShaderSource(vertShader, 1, &vertShaderSrc, NULL);
	glCompileShader(vertShader);

	// Check vertex shader
	glGetShaderiv(vertShader, GL_COMPILE_STATUS, &result);
	glGetShaderiv(vertShader, GL_INFO_LOG_LENGTH, &logLength);


	// Compile fragment shader
	std::cout << "Compiling fragment shader." << std::endl;
	//std::cout << fragShaderSrc << std::endl;
	glShaderSource(fragShader, 1, &fragShaderSrc, NULL);
	glCompileShader(fragShader);
	
	GLint compiled;
	glGetShaderiv(fragShader, GL_COMPILE_STATUS, &compiled);
	//mada_check_gl_error();
	if (!compiled)
	{
		GLint length;
		glGetShaderiv(fragShader, GL_INFO_LOG_LENGTH, &length);
		//mada_check_gl_error();
		if (length > 0)
		{
			GLint infoLength;
			char* infoBuf = (char*)malloc(sizeof(char)* length);
			glGetShaderInfoLog(fragShader, length, &infoLength, infoBuf);
			printf("ERROR: %s", infoBuf);
			//mada_check_gl_error();
			//mada_log(logERROR, infoBuf);
			//SysUtils::error("Error compiling shader. See log for info.");
			free(infoBuf);
		}
		//SysUtils::error("Failed to compile shader. No further info available.");
	}

	// Check fragment shader
	glGetShaderiv(fragShader, GL_COMPILE_STATUS, &result);
	glGetShaderiv(fragShader, GL_INFO_LOG_LENGTH, &logLength);

	std::cout << "Linking program" << std::endl;
	GLuint program = glCreateProgram();
	glAttachShader(program, vertShader);
	glAttachShader(program, fragShader);
	glLinkProgram(program);

	printProgramInfoLog(program);   // verifies if all this is ok so far

	glGetProgramiv(program, GL_LINK_STATUS, &result);
	glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
	std::vector<char> programError((logLength > 1) ? logLength : 1);
	glGetProgramInfoLog(program, logLength, NULL, &programError[0]);
	std::cout << &programError[0] << std::endl;

	glDeleteShader(vertShader);
	glDeleteShader(fragShader);

	return program;
}


// Our GL INITS
bool init(void){    
   glClearColor(0.7f, 0.7f, 0.7f, 0.5f);	// Black Background

   program_object = LoadShader("VertexShader.vert", "FragmentShader.frag");
   glUseProgram(program_object);

   /* PARSING OBJECTS BITCHES */
   std::cout << "Starting to send memory: " << std::endl;
   objLoader* loadedObject = parseObj();

   // export verts
   float* vertArray = VertsToFloat3(loadedObject->vertexList, loadedObject->vertexCount);

   // export faces
   int* faceArray = FacesToVerts(loadedObject->faceList, loadedObject->faceCount);
   float* materials = GetObjectMaterials(loadedObject, loadedObject->faceCount);
   int* faceMats = FacesToMats(loadedObject, loadedObject->faceCount);

   // Global Variables
   int BufferUBO; // Location for the UBO given by OpenGL
   int BufferIndex = 0; // Index to use for the buffer binding (All good things start at 0 )
   int UniformBlockLocation; // Uniform Block Location in the program given by OpenGL


   // Structs
   //[Serializable]
   //[StructLayout(LayoutKind.Sequential)]
   /*
   struct Light {
	   float X;
	   float Y;
	   float Z;
   };

   struct colors0
   {
	   Light Lights[4];
   };


   GLuint m_lightsUBO, uniformBlockIndex, uindex, vshad_id, fshad_id, prog_id;
   colors0 UBOData;
   UBOData.Lights[0].X = 1.0;

   GLuint vbuffer;
   //glGenBuffers(1, &vbuffer);
   //glBindBuffer(GL_UNIFORM_BUFFER_EXT, vbuffer);
   //glBufferData(GL_UNIFORM_BUFFER_EXT, (sizeof(float)* 8 * UBOData.Length), UBOData, GL_STATIC_READ);

   //Update the uniforms using ARB_uniform_buffer_object
   glGenBuffers(1, &vbuffer);

   //There's only one uniform block here, the 'colors0' uniform block. 
   //It contains the color info for the gooch shader.
   uniformBlockIndex = glGetUniformLocation(program_object, "colors0");

   //Create UBO.
   glBindBuffer(GL_UNIFORM_BUFFER_EXT, vbuffer);
   glBufferData(GL_UNIFORM_BUFFER_EXT, (sizeof(float)* 3 * 4), NULL, GL_DYNAMIC_DRAW);

   //Now we attach the buffer to UBO binding point 0...
   
   glBindBufferBaseNV(GL_UNIFORM_BUFFER_EXT, 0, vbuffer);
   //And associate the uniform block to this binding point.
   //glUniformBlockBinding(prog_id, uniformBlockIndex, 0);
   //glError();

   // 
   //glGenBuffers(1, &m_lightsUBO); // this generates UBO, OK
   //glBindBuffer(GL_UNIFORM_BUFFER, m_lightsUBO); // this binds it, OK
   //glBufferData(GL_UNIFORM_BUFFER, (sizeof(float)* 8 * UBOData.Length), NULL, GL_DYNAMIC_DRAW); // this allocates space for the UBO. 
   //glBindBufferRange(GL_UNIFORM_BUFFER, glGetUniformLocation(program_object, "lights"), m_lightsUBO, 0, (sizeof(float)* 8 * UBOData.Length)); // this binds UBO to Buffer Index

   //glBindBuffer(GL_UNIFORM_BUFFER, m_lightsUBO);
   //glBufferSubData(GL_UNIFORM_BUFFER, 0, (sizeof(float)* 8 * UBOData.Length), UBOData);
   //glBindBuffer(GL_UNIFORM_BUFFER, 0);
   */

	printf("GL_VERSION:%s\n", glGetString(GL_SHADING_LANGUAGE_VERSION));

	glUniform1fv(glGetUniformLocation(program_object, "verts"), loadedObject->vertexCount*3, vertArray);
	glUniform1iv(glGetUniformLocation(program_object, "faces"), loadedObject->faceCount*3, faceArray);
	glUniform1iv(glGetUniformLocation(program_object, "faceMat"), loadedObject->faceCount, faceMats);
	glUniform1fv(glGetUniformLocation(program_object, "Materials"), loadedObject->materialCount*3, materials);
	glUniform1i(glGetUniformLocation(program_object, "faceCount"), loadedObject->faceCount);
	std::cout << "Finished sending memory: FaceCount:" << loadedObject->faceCount << std::endl;
 
	return true;
}

// Our rendering is done here
void render(void)  {
	float scale = 10.0f;
	
	glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);	// Clear Screen And Depth Buffer
	glLoadIdentity();									// Reset The Current Modelview Matrix

	gluLookAt(0.0, 0.0, 3.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);
	
	// bind the GLSL program	
	// this means that from here the GLSL program attends all OpenGL operations
	glUseProgram(program_object);

	//
	glBegin(GL_QUADS);
		glVertex3f(-0.5*scale, -0.5*scale, 0.0);
		glVertex3f(0.5*scale, -0.5*scale, 0.0);
		glVertex3f(0.5*scale, 0.5*scale, 0.0);
		glVertex3f(-0.5*scale, 0.5*scale, 0.0);
	glEnd();
	
	// unbind the GLSL program
	// this means that from here the OpenGL fixed functionality is used
	glUseProgram(0);
	
	// Swap The Buffers To Become Our Rendering Visible
	glutSwapBuffers( );

	// Timer
	newtime = glutGet(GLUT_ELAPSED_TIME);
	double difference = (newtime - oldtime)/1000;
	oldtime = newtime;

	std::cout << "Time: " << difference << std::endl;
}

// Our Reshaping Handler (Required Even In Fullscreen-Only Modes)
void reshape(int w, int h){
	glViewport(0, 0, w, h);
	glMatrixMode(GL_PROJECTION);     // Select The Projection Matrix
	glLoadIdentity();                // Reset The Projection Matrix
	
	// Calculate The Aspect Ratio And Set The Clipping Volume
	if (h == 0) h = 1;
	gluPerspective(90, (float)w/(float)h, 0.1, 100.0);
	glMatrixMode(GL_MODELVIEW);      // Select The Modelview Matrix
	glLoadIdentity();                // Reset The Modelview Matrix

	// Variables
	GLint loc = glGetUniformLocation(program_object, "iResolution");
	if (loc != -1)
	{
		std::cout << "Setting uniform variables" << std::endl;
		glUniform2f(loc, w, h);
	}

	float test[982] = {1.0};
}

// Our keyboard handler
void keyboard(unsigned char key, int x, int y){
	switch (key) {
		case 27:       // When escape is pressed...
			//exit(0);    // Exit The Program
		   break;      
		default:       
		break;
	}
}

// Main Function For Bringing It All Together.
int main(int argc, char** argv){	
	glutInit(&argc, argv);                           // GLUT Initializtion
	glutInitDisplayMode(GLUT_RGBA | GLUT_DOUBLE | GLUT_DEPTH);     // Display Mode (Rgb And Double Buffered)	
	glutCreateWindow("GLSL PathTracer V0.01");       // Window Title 
	
	init();                                          // Our Initialization
	glutDisplayFunc(render);                         // Register The Display Function
	glutReshapeFunc(reshape);                        // Register The Reshape Handler
	glutKeyboardFunc(keyboard);                      // Register The Keyboard Handler	
	//glutIdleFunc(render);                            // Do Rendering In Idle Time
	glutMainLoop();                                  // Go To GLUT Main Loop
	return 0;
}
