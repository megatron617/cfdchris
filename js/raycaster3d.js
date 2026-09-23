/**
 * 3D Raycasting utilities for mouse interaction
 * Converts 2D screen coordinates to 3D world positions
 */

export class Raycaster3D {
    constructor(camera) {
        this.camera = camera;
    }

    /**
     * Cast a ray from screen coordinates into 3D space
     * @param {number} screenX - Normalized screen X (0-1)
     * @param {number} screenY - Normalized screen Y (0-1)
     * @returns {Object} { hit: boolean, point: [x,y,z], distance: number }
     */
    castRay(screenX, screenY) {
        // Convert screen coordinates to NDC (Normalized Device Coordinates)
        // Screen: (0,0) = bottom-left, (1,1) = top-right
        // NDC: (-1,-1) = bottom-left, (1,1) = top-right
        const ndcX = screenX * 2.0 - 1.0;
        const ndcY = screenY * 2.0 - 1.0;

        // Get camera matrices
        const viewMatrix = this.camera.getViewMatrix();
        const projMatrix = this.camera.getProjectionMatrix();

        // Compute inverse view-projection matrix
        const viewProjMatrix = this.multiplyMatrices(projMatrix, viewMatrix);
        const invViewProjMatrix = this.invertMatrix(viewProjMatrix);

        // Unproject NDC coordinates to world space
        // Near plane (z = -1 in NDC)
        const nearPoint = this.transformPoint(invViewProjMatrix, [ndcX, ndcY, -1.0]);
        // Far plane (z = 1 in NDC)
        const farPoint = this.transformPoint(invViewProjMatrix, [ndcX, ndcY, 1.0]);

        // Compute ray direction
        const rayOrigin = nearPoint;
        const rayDir = this.normalize(this.subtract(farPoint, nearPoint));

        // Intersect ray with unit cube [0,0,0] to [1,1,1]
        const intersection = this.intersectRayBox(rayOrigin, rayDir, [0, 0, 0], [1, 1, 1]);

        return intersection;
    }

    /**
     * Ray-box intersection using slab method
     * @returns {Object} { hit: boolean, point: [x,y,z], distance: number }
     */
    intersectRayBox(rayOrigin, rayDir, boxMin, boxMax) {
        let tmin = -Infinity;
        let tmax = Infinity;

        // Test each slab (X, Y, Z)
        for (let i = 0; i < 3; i++) {
            if (Math.abs(rayDir[i]) < 1e-8) {
                // Ray is parallel to slab
                if (rayOrigin[i] < boxMin[i] || rayOrigin[i] > boxMax[i]) {
                    return { hit: false, point: null, distance: Infinity };
                }
            } else {
                const ood = 1.0 / rayDir[i];
                let t1 = (boxMin[i] - rayOrigin[i]) * ood;
                let t2 = (boxMax[i] - rayOrigin[i]) * ood;

                if (t1 > t2) {
                    const temp = t1;
                    t1 = t2;
                    t2 = temp;
                }

                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);

                if (tmin > tmax) {
                    return { hit: false, point: null, distance: Infinity };
                }
            }
        }

        // Ray hits box
        if (tmax >= 0) {
            // Use tmin if positive (entry point), otherwise tmax (we're inside)
            const t = tmin >= 0 ? tmin : tmax;
            const hitPoint = [
                rayOrigin[0] + rayDir[0] * t,
                rayOrigin[1] + rayDir[1] * t,
                rayOrigin[2] + rayDir[2] * t
            ];

            return {
                hit: true,
                point: hitPoint,
                distance: t
            };
        }

        return { hit: false, point: null, distance: Infinity };
    }

    /**
     * Transform a point by a 4x4 matrix (with perspective divide)
     */
    transformPoint(matrix, point) {
        const x = point[0];
        const y = point[1];
        const z = point[2];
        const w = 1.0;

        const xOut = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
        const yOut = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
        const zOut = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
        const wOut = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;

        // Perspective divide
        if (Math.abs(wOut) > 1e-8) {
            return [xOut / wOut, yOut / wOut, zOut / wOut];
        } else {
            return [xOut, yOut, zOut];
        }
    }

    /**
     * Multiply two 4x4 matrices (column-major order)
     */
    multiplyMatrices(a, b) {
        const result = new Array(16);

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[i + k * 4] * b[k + j * 4];
                }
                result[i + j * 4] = sum;
            }
        }

        return result;
    }

    /**
     * Invert a 4x4 matrix
     * Uses Gaussian elimination (simplified for this use case)
     */
    invertMatrix(m) {
        const inv = new Array(16);

        inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
                 m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
        inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
                 m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
        inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
                 m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
        inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
                  m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];

        inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
                 m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
        inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
                 m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
        inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
                 m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
        inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
                  m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];

        inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
                 m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
        inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
                 m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
        inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
                  m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
        inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
                  m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];

        inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
                 m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
        inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
                 m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
        inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
                  m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
        inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
                  m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

        let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

        if (Math.abs(det) < 1e-8) {
            console.warn('Matrix is singular, cannot invert');
            return this.identityMatrix();
        }

        det = 1.0 / det;

        for (let i = 0; i < 16; i++) {
            inv[i] = inv[i] * det;
        }

        return inv;
    }

    /**
     * Create identity matrix
     */
    identityMatrix() {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    // Vector operations
    subtract(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    length(v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }

    normalize(v) {
        const len = this.length(v);
        return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
    }
}
