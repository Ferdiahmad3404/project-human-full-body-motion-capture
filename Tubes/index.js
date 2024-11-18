import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';

const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');

const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
});

holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});

holistic.onResults((results) => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Gambar pose landmarks
    if (results.poseLandmarks) {
        results.poseLandmarks.forEach(({ x, y }) => {
            canvasCtx.beginPath();
            canvasCtx.arc(x * canvasElement.width, y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'blue';
            canvasCtx.fill();
        });
    }

    // Gambar tangan
    if (results.rightHandLandmarks || results.leftHandLandmarks) {
        const handLandmarks = [
            ...results.rightHandLandmarks || [],
            ...results.leftHandLandmarks || [],
        ];
        handLandmarks.forEach(({ x, y }) => {
            canvasCtx.beginPath();
            canvasCtx.arc(x * canvasElement.width, y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'red';
            canvasCtx.fill();
        });
    }
});

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await holistic.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
});

camera.start();
