import { useRef, useEffect, useState, useCallback } from 'react';
import { mat4, quat, vec3 } from 'gl-matrix';

function Home() {
  const canvasRef = useRef(null);
  const [rotationQuat, setRotationQuat] = useState(quat.create());
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showMesh, setShowMesh] = useState(false);
  const programInfoRef = useRef(null);
  const buffersRef = useRef(null);
  const glRef = useRef(null);
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
      quat.multiply(newQuat, newQuat, rotationQuat);
      setRotationQuat(newQuat);
    }
  }, [rotationQuat]);

  const handleGestureStart = (e) => {
    e.preventDefault();
  };

  const handleGestureChange = (e) => {
    e.preventDefault();
    let newZoomLevel = zoomLevel * e.scale;
    newZoomLevel = Math.max(0.1, newZoomLevel); // Allow zooming out to 10% of the original size
    setZoomLevel(newZoomLevel);
  };

  const handleGestureEnd = (e) => {
    e.preventDefault();
  };

  const handleToggleMesh = () => {
    setShowMesh(!showMesh);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2');
    glRef.current = gl;

    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    const programInfo = initProgramInfo(gl);
    if (!programInfo) {
      console.error('Failed to initialize program info');
      return;
    }
    buffersRef.current = initBuffers(gl);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);
    programInfo.projectionMatrix = projectionMatrix;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    programInfoRef.current = programInfo;
    drawScene();

    canvas.addEventListener('gesturestart', handleGestureStart);
    canvas.addEventListener('gesturechange', handleGestureChange);
    canvas.addEventListener('gestureend', handleGestureEnd);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureChange);
      canvas.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  useEffect(() => {
    drawScene();
  }, [rotationQuat, zoomLevel, showMesh]);

  const drawScene = () => {
    const gl = glRef.current;
    if (!gl) return;

    const programInfo = programInfoRef.current;
    const buffers = buffersRef.current;
    if (!programInfo || !buffers) return;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);
    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, rotationQuat);
    mat4.multiply(modelViewMatrix, modelViewMatrix, rotationMatrix);

    const projectionMatrix = mat4.clone(programInfo.projectionMatrix);
    mat4.scale(projectionMatrix, projectionMatrix, [zoomLevel, zoomLevel, 1.0]);

    drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix, showMesh);
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
      <button onClick={handleToggleMesh} style={{ position: 'absolute', top: '10px', left: '10px' }}>
        Toggle Mesh
      </button>
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
    uniform vec3 uLightPosition;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientLight;
    varying highp vec3 vLighting;
    varying highp vec3 vNormal;
    varying highp vec3 vPosition;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vNormal = mat3(uNormalMatrix) * aVertexNormal;
      vPosition = vec3(uModelViewMatrix * aVertexPosition);
      highp vec3 ambient = uAmbientLight;
      highp vec3 lightDirection = normalize(uLightPosition - vPosition);
      highp float diffuse = max(dot(vNormal, lightDirection), 0.0);
      highp vec3 reflectDir = reflect(-lightDirection, vNormal);
      highp vec3 viewDir = normalize(-vPosition);
      highp float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      vLighting = ambient + (uLightColor * diffuse) + (uLightColor * specular);
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
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  const fsSourceMesh = `
    void main(void) {
      gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
  `;

  const vsSourceRayMarching = `
    precision highp float;
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vRayDirection;
    void main(void) {
      vec4 worldPosition = uModelViewMatrix * aVertexPosition;
      vRayDirection = normalize(worldPosition.xyz);
      gl_Position = uProjectionMatrix * worldPosition;
    }
  `;

  const fsSourceRayMarching = `
    precision highp float;
    varying vec3 vRayDirection;
    uniform vec3 uCameraPosition;
    uniform vec3 uLightPosition;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientLight;
    const int MAX_STEPS = 100;
    const float MAX_DISTANCE = 100.0;
    const float SURFACE_DISTANCE = 0.01;
    float sphereSDF(vec3 point, vec3 center, float radius) {
      return length(point - center) - radius;
    }
    float sceneSDF(vec3 point) {
      return sphereSDF(point, vec3(0.0, 0.0, 0.0), 1.0);
    }
    vec3 estimateNormal(vec3 point) {
      const vec3 smallStep = vec3(0.001, 0.0, 0.0);
      float gradientX = sceneSDF(point + smallStep.xyy) - sceneSDF(point - smallStep.xyy);
      float gradientY = sceneSDF(point + smallStep.yxy) - sceneSDF(point - smallStep.yxy);
      float gradientZ = sceneSDF(point + smallStep.yyx) - sceneSDF(point - smallStep.yyx);
      return normalize(vec3(gradientX, gradientY, gradientZ));
    }
    float rayMarch(vec3 rayOrigin, vec3 rayDirection) {
      float distanceFromOrigin = 0.0;
      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 currentPoint = rayOrigin + distanceFromOrigin * rayDirection;
        float distanceToSurface = sceneSDF(currentPoint);
        if (distanceToSurface < SURFACE_DISTANCE) {
          return distanceFromOrigin;
        }
        distanceFromOrigin += distanceToSurface;
        if (distanceFromOrigin >= MAX_DISTANCE) {
          return MAX_DISTANCE;
        }
      }
      return MAX_DISTANCE;
    }
    void main(void) {
      vec3 rayOrigin = uCameraPosition;
      vec3 rayDirection = normalize(vRayDirection);
      float distance = rayMarch(rayOrigin, rayDirection);
      if (distance < MAX_DISTANCE) {
        vec3 hitPoint = rayOrigin + rayDirection * distance;
        vec3 normal = estimateNormal(hitPoint);
        vec3 lightDirection = normalize(uLightPosition - hitPoint);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        vec3 reflectDir = reflect(-lightDirection, normal);
        vec3 viewDir = normalize(uCameraPosition - hitPoint);
        float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        vec3 color = uAmbientLight + (uLightColor * diffuse) + (uLightColor * specular);
        gl_FragColor = vec4(color, 1.0);
      } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      }
    }
  `;

  const vsSourceOcclusion = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

  const fsSourceOcclusion = `
    void main(void) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  const vsSourcePCF = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
    uniform mat4 uLightSpaceMatrix;
    varying highp vec3 vLighting;
    varying highp vec3 vNormal;
    varying highp vec3 vPosition;
    varying highp vec4 vLightSpacePosition;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vNormal = mat3(uNormalMatrix) * aVertexNormal;
      vPosition = vec3(uModelViewMatrix * aVertexPosition);
      vLightSpacePosition = uLightSpaceMatrix * aVertexPosition;
      highp vec3 ambient = vec3(0.3, 0.3, 0.3);
      highp vec3 lightDirection = normalize(vec3(5.0, 5.0, 5.0) - vPosition);
      highp float diffuse = max(dot(vNormal, lightDirection), 0.0);
      highp vec3 reflectDir = reflect(-lightDirection, vNormal);
      highp vec3 viewDir = normalize(-vPosition);
      highp float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      vLighting = ambient + (vec3(1.0, 1.0, 1.0) * diffuse) + (vec3(1.0, 1.0, 1.0) * specular);
    }
  `;

  const fsSourcePCF = `
    varying highp vec3 vLighting;
    varying highp vec4 vLightSpacePosition;
    uniform sampler2D uShadowMap;
    uniform float uShadowBias;
    uniform vec3 uLightColor;
    void main(void) {
      highp vec3 color = vec3(1.0, 0.0, 0.0);
      highp vec3 lighting = vLighting;
      highp vec3 shadowCoord = vLightSpacePosition.xyz / vLightSpacePosition.w;
      shadowCoord = shadowCoord * 0.5 + 0.5;
      highp float shadow = 0.0;
      highp float shadowMapValue = texture2D(uShadowMap, shadowCoord.xy).r;
      if (shadowCoord.z > shadowMapValue + uShadowBias) {
        shadow = 0.5;
      }
      lighting = mix(lighting, lighting * shadow, shadow);
      gl_FragColor = vec4(color * lighting, 1.0);
    }
  `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    console.error('Failed to initialize shader program');
    return null;
  }
  const edgeShaderProgram = initShaderProgram(gl, vsSource, fsSourceEdges);
  if (!edgeShaderProgram) {
    console.error('Failed to initialize edge shader program');
    return null;
  }
  const meshShaderProgram = initShaderProgram(gl, vsSource, fsSourceMesh);
  if (!meshShaderProgram) {
    console.error('Failed to initialize mesh shader program');
    return null;
  }
  const rayMarchingShaderProgram = initShaderProgram(gl, vsSourceRayMarching, fsSourceRayMarching);
  if (!rayMarchingShaderProgram) {
    console.error('Failed to initialize ray marching shader program');
    return null;
  }
  const occlusionShaderProgram = initShaderProgram(gl, vsSourceOcclusion, fsSourceOcclusion);
  if (!occlusionShaderProgram) {
    console.error('Failed to initialize occlusion shader program');
    return null;
  }
  const pcfShaderProgram = initShaderProgram(gl, vsSourcePCF, fsSourcePCF);
  if (!pcfShaderProgram) {
    console.error('Failed to initialize PCF shader program');
    return null;
  }
  return {
    program: shaderProgram,
    edgeProgram: edgeShaderProgram,
    meshProgram: meshShaderProgram,
    rayMarchingProgram: rayMarchingShaderProgram,
    occlusionProgram: occlusionShaderProgram,
    pcfProgram: pcfShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
    },
    edgeAttribLocations: {
      vertexPosition: gl.getAttribLocation(edgeShaderProgram, 'aVertexPosition'),
    },
    meshAttribLocations: {
      vertexPosition: gl.getAttribLocation(meshShaderProgram, 'aVertexPosition'),
    },
    rayMarchingAttribLocations: {
      vertexPosition: gl.getAttribLocation(rayMarchingShaderProgram, 'aVertexPosition'),
    },
    occlusionAttribLocations: {
      vertexPosition: gl.getAttribLocation(occlusionShaderProgram, 'aVertexPosition'),
    },
    pcfAttribLocations: {
      vertexPosition: gl.getAttribLocation(pcfShaderProgram, 'aVertexPosition'),
      vertexNormal: gl.getAttribLocation(pcfShaderProgram, 'aVertexNormal'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
      lightPosition: gl.getUniformLocation(shaderProgram, 'uLightPosition'),
      lightColor: gl.getUniformLocation(shaderProgram, 'uLightColor'),
      ambientLight: gl.getUniformLocation(shaderProgram, 'uAmbientLight'),
    },
    edgeUniformLocations: {
      projectionMatrix: gl.getUniformLocation(edgeShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(edgeShaderProgram, 'uModelViewMatrix'),
    },
    meshUniformLocations: {
      projectionMatrix: gl.getUniformLocation(meshShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(meshShaderProgram, 'uModelViewMatrix'),
    },
    rayMarchingUniformLocations: {
      projectionMatrix: gl.getUniformLocation(rayMarchingShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(rayMarchingShaderProgram, 'uModelViewMatrix'),
      cameraPosition: gl.getUniformLocation(rayMarchingShaderProgram, 'uCameraPosition'),
      lightPosition: gl.getUniformLocation(rayMarchingShaderProgram, 'uLightPosition'),
      lightColor: gl.getUniformLocation(rayMarchingShaderProgram, 'uLightColor'),
      ambientLight: gl.getUniformLocation(rayMarchingShaderProgram, 'uAmbientLight'),
    },
    occlusionUniformLocations: {
      projectionMatrix: gl.getUniformLocation(occlusionShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(occlusionShaderProgram, 'uModelViewMatrix'),
    },
    pcfUniformLocations: {
      projectionMatrix: gl.getUniformLocation(pcfShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(pcfShaderProgram, 'uModelViewMatrix'),
      normalMatrix: gl.getUniformLocation(pcfShaderProgram, 'uNormalMatrix'),
      lightSpaceMatrix: gl.getUniformLocation(pcfShaderProgram, 'uLightSpaceMatrix'),
      shadowMap: gl.getUniformLocation(pcfShaderProgram, 'uShadowMap'),
      shadowBias: gl.getUniformLocation(pcfShaderProgram, 'uShadowBias'),
      lightColor: gl.getUniformLocation(pcfShaderProgram, 'uLightColor'),
    },
  };
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    console.error('Failed to create shaders');
    return null;
  }

  const shaderProgram = gl.createProgram();
  if (!(vertexShader instanceof WebGLShader) || !(fragmentShader instanceof WebGLShader)) {
    console.error('Shader creation failed');
    return null;
  }
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
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

  const vertexNormals = [
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);

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

function drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix, showMesh) {
  if (!gl.createQuery) {
    console.error('WebGL2 createQuery not supported');
    return;
  }

  const query = gl.createQuery();
  gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);

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

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

  gl.uniform3fv(programInfo.uniformLocations.lightPosition, [5.0, 5.0, 5.0]);
  gl.uniform3fv(programInfo.uniformLocations.lightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(programInfo.uniformLocations.ambientLight, [0.3, 0.3, 0.3]);

  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndices);
  gl.useProgram(programInfo.edgeProgram);
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.modelViewMatrix, false, modelViewMatrix);
  {
    const edgeVertexCount = 24;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.LINES, edgeVertexCount, type, offset);
  }

  if (showMesh) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.useProgram(programInfo.meshProgram);
    gl.uniformMatrix4fv(programInfo.meshUniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.meshUniformLocations.modelViewMatrix, false, modelViewMatrix);
    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.LINES, vertexCount, type, offset);
    }
  }

  gl.useProgram(programInfo.rayMarchingProgram);
  gl.uniformMatrix4fv(programInfo.rayMarchingUniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.rayMarchingUniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniform3fv(programInfo.rayMarchingUniformLocations.cameraPosition, [0.0, 0.0, 5.0]);
  gl.uniform3fv(programInfo.rayMarchingUniformLocations.lightPosition, [5.0, 5.0, 5.0]);
  gl.uniform3fv(programInfo.rayMarchingUniformLocations.lightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(programInfo.rayMarchingUniformLocations.ambientLight, [0.3, 0.3, 0.3]);
  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  gl.useProgram(programInfo.pcfProgram);
  gl.uniformMatrix4fv(programInfo.pcfUniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.pcfUniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix4fv(programInfo.pcfUniformLocations.normalMatrix, false, normalMatrix);
  gl.uniformMatrix4fv(programInfo.pcfUniformLocations.lightSpaceMatrix, false, mat4.create());
  gl.uniform1i(programInfo.pcfUniformLocations.shadowMap, 0);
  gl.uniform1f(programInfo.pcfUniformLocations.shadowBias, 0.005);
  gl.uniform3fv(programInfo.pcfUniformLocations.lightColor, [1.0, 1.0, 1.0]);
  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  gl.endQuery(gl.ANY_SAMPLES_PASSED);
  const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
  const passed = gl.getQueryParameter(query, gl.QUERY_RESULT);

  if (available && passed) {
    // Object is visible, render it
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }
  }
}

export default Home;
