# WebGL 3D Cube

This repository contains a simple WebGL application that renders a 3D cube on a black background. The cube is red.

## Getting Started

To run this application:

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000` to see the 3D cube.

## Project Structure

- `pages/index.js`: Contains the WebGL code for rendering the 3D cube.
- `global.css`: Contains global styles for the application, including setting the background color to black.

## Dependencies

- `next`: ^14.1.1
- `react`: ^18.2.0
- `react-dom`: ^18.2.0

## Using the Slider

A slider UI component has been added to control the rotation of the cube. You can use the slider at the bottom of the screen to rotate the cube along the Y-axis.

## Frustum Culling Optimization

This project includes an optimization technique called frustum culling to avoid rendering parts of the cube that are not visible. Frustum culling improves performance by skipping the rendering of faces of the cube that are outside the view frustum.

### Benefits of Frustum Culling

- **Improved Performance**: By not rendering faces that are not visible, the application can run more efficiently and smoothly.
- **Reduced GPU Load**: Frustum culling reduces the number of draw calls and the amount of work the GPU has to do, leading to better overall performance.

### How to Use

The frustum culling optimization is automatically applied when rendering the cube. No additional configuration is required. Simply run the application as described in the "Getting Started" section, and the optimization will be in effect.

## Caching Mechanisms for Optimization

This project also includes caching mechanisms to further optimize performance by reducing redundant computations.

### Caching Mechanisms Introduced

- **Transformation Matrices**: The transformation matrices are cached to avoid redundant computations in the `drawScene` function.
- **Transformed Positions**: The results of `calculateTransformedPositions` are cached and reused if the model view matrix has not changed.
- **Frustum Planes**: The results of `computeFrustumPlanes` are cached and reused if the projection or model view matrix has not changed.

### Benefits of Caching

- **Reduced CPU Load**: By caching and reusing previously computed values, the CPU load is significantly reduced.
- **Improved Performance**: Caching helps in avoiding redundant computations, leading to smoother and more efficient rendering.

## Lighting and Shadows

This project now includes a fixed light source with visible source, and shadows and highlights are added to the webpage. The light source is a point light and is white in color. The shaders use Phong shading to calculate the lighting effects.

### Light Source and Shadows

The light source is fixed and positioned in the scene. The vertex shader includes normal vectors and calculates lighting effects based on the light source. The fragment shader calculates the final color of the cube based on the lighting effects, including shadows and highlights.

### Adjusting Light Source

To adjust the light source position and color, you can modify the relevant code in `pages/index.js`. Look for the light position and color definitions in the `initProgramInfo` function and update them as needed.
