import { useRef, useEffect, useState, useCallback } from 'react';
import { mat4, quat, vec3 } from 'gl-matrix';

function Home() {
  const canvasRef = useRef(null);
  const [rotationQuat, setRotationQuat] = useState(quat.create());
  const [zoomLevel, setZoomLevel] = useState(1.0); // P77ea
  const programInfoRef = useRef(null); // Cache shader program info
  const buffersRef = useRef(null); // Cache buffers
  const glRef = useRef(null); // Cache WebGL context
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    canvasRef.current.style.cursor = "grabbing";
  }

  const handleMouseUp = () => {
    isDragging.current = false;
    canvasRef.current.style.cursor = "grab";
  }

  const handleMouseMove = useCallback((e) => {
    if (isDragging.current) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const rotationAngle = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 0.01;
      const rotationAxis = vec3.fromValues(deltaY, deltaX, 0.0);
      vec3.normalize(rotationAxis, rotationAxis);

      const newQuat = quat.create();
      quat.setAxisAngle(newQuat, rotationAxis, rotationAngle);
      quat.multiply(newQuat, newQuat, rotationQuat); // Accumulate rotation
      setRotationQuat(newQuat);
    }
  }, [rotationQuat]);

  const handleGestureStart = (e) => {
    e.preventDefault();
  };

  const handleGestureChange = (e) => {
    e.preventDefault();
    let newZoomLevel = zoomLevel * e.scale;
    newZoomLevel = Math.max(0.5, newZoomLevel); // P6662
    setZoomLevel(newZoomLevel);
  };

  const handleGestureEnd = (e) => {
    e.preventDefault();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    glRef.current = gl; // Cache WebGL context

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Initialize shaders, buffers, etc.
    const programInfo = initProgramInfo(gl);
    buffersRef.current = initBuffers(gl);

    // Cache projection matrix
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);
    programInfo.projectionMatrix = projectionMatrix;

    // Resize handling
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    programInfoRef.current = programInfo;
    drawScene(); // Initial draw

    // Add event listeners for pinch gestures
    canvas.addEventListener('gesturestart', handleGestureStart); // P857b
    canvas.addEventListener('gesturechange', handleGestureChange); // P857b
    canvas.addEventListener('gestureend', handleGestureEnd); // P857b

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('gesturestart', handleGestureStart); // P857b
      canvas.removeEventListener('gesturechange', handleGestureChange); // P857b
      canvas.removeEventListener('gestureend', handleGestureEnd); // P857b
    };
  }, []);

  useEffect(() => {
    drawScene(); // Redraw on rotation or zoom change
  }, [rotationQuat, zoomLevel]); // P6545

  const drawScene = () => {
    const gl = glRef.current;
    if (!gl) return;

    const programInfo = programInfoRef.current;
    const buffers = buffersRef.current;
    if (!programInfo || !buffers) return;

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Calculate model-view matrix from quaternion
    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);
    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, rotationQuat);
    mat4.multiply(modelViewMatrix, modelViewMatrix, rotationMatrix);

    // Update projection matrix with zoom level
    const projectionMatrix = mat4.clone(programInfo.projectionMatrix);
    mat4.scale(projectionMatrix, projectionMatrix, [zoomLevel, zoomLevel, 1.0]); // P6545

    // Draw the scene
    drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix); // P6545
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: '100vw', height: '100vh', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      ></canvas>
    </>
  );
}

function initProgramInfo(gl) {
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
    varying highp vec3 vLighting;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      // Apply lighting effect
      highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
      highp vec3 directionalLightColor = vec3(1, 1, 1);
      highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));
      highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);
      highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
      vLighting = ambientLight + (directionalLightColor * directional);
    }
  `;

  const fsSource = `
    varying highp vec3 vLighting;
    void main(void) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      gl_FragColor.rgb *= vLighting;
    }
  `;

  const fsSourceEdges = `
    void main(void) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color for edges
    }
  `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const edgeShaderProgram = initShaderProgram(gl, vsSource, fsSourceEdges);
  return {
    program: shaderProgram,
    edgeProgram: edgeShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
    },
    edgeAttribLocations: {
      vertexPosition: gl.getAttribLocation(edgeShaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
    },
    edgeUniformLocations: {
      projectionMatrix: gl.getUniformLocation(edgeShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(edgeShaderProgram, 'uModelViewMatrix'),
    },
  };
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initBuffers(gl) {
  // Create a buffer for the cube's vertex positions.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Define the positions for each vertex of the cube.
  const positions = [
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
  ];

  // Assign positions to buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create a buffer for the cube's vertex normals.
  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

  // Define the normals for each vertex of the cube.
  const vertexNormals = [
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];

  // Assign normals to buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);

  // Element buffer for the indices of the cube's faces.
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  const edgeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
  const edgeIndices = [
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7,
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edgeIndices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    normal: normalBuffer,
    indices: indexBuffer,
    edgeIndices: edgeIndexBuffer,
  };
}

function drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix) { // P6545
  // Vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Vertex normals
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexNormal,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
  }

  // Element array for faces
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  // Use shader program
  gl.useProgram(programInfo.program);
  // Set shader uniforms
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix); // P6545
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

  // Calculate and set the normal matrix
  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

  // Draw the cube faces
  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  // Draw edges
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndices);
  gl.useProgram(programInfo.edgeProgram);
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.projectionMatrix, false, projectionMatrix); // P6545
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.modelViewMatrix, false, modelViewMatrix);
  {
    const edgeVertexCount = 24;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.LINES, edgeVertexCount, type, offset);
  }
}

export default Home;
