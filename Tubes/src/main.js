import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Inisialisasi MediaPipe Pose
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// Inisialisasi Three.js
let model;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Tambahkan pencahayaan
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Tambahkan grid helper
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

let rightUpperArmBone;  // Reference to right upper arm bone
let rightForeArmBone;   // Reference to right forearm bone
let rightHandBone;      // Reference to right hand bone
let leftUpperArmBone;   // Reference to left upper arm bone
let leftForeArmBone;    // Reference to left forearm bone
let leftHandBone;       // Reference to left hand bone

// Muat model GLB
const loader = new GLTFLoader();
loader.load('src/human.glb', (gltf) => {
    console.log('Model loaded successfully'); // Log saat model berhasil dimuat
    model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }
        if (child.isBone) {
            console.log(`Bone found: ${child.name}`); // Log setiap tulang yang ditemukan
            // Update bone references untuk UpperArm, ForeArm, dan Hand
            if (child.name === 'upper_armR') rightUpperArmBone = child;
            // console.log("bone right upper :", rightUpperArmBone);
            if (child.name === 'forearmR') rightForeArmBone = child;
            // console.log("bone right forearm :", rightForeArmBone);
            if (child.name === 'handR') rightHandBone = child;
            if (child.name === 'upper_armL') leftUpperArmBone = child;
            if (child.name === 'forearmL') leftForeArmBone = child;
            if (child.name === 'handL') leftHandBone = child;
        }
    });
    scene.add(model);
    model.scale.set(2, 2, 2);
    model.position.set(0, 0, 0);
}, undefined, (error) => {
    console.error('Error loading model:', error); // Log jika terjadi kesalahan saat memuat model
});

// Atur posisi kamera
camera.position.z = 5;

// Fungsi animasi
const animate = function () {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
};
animate();

// MediaPipe Setup
const videoElement = document.getElementById('cameraFeed');
const canvasElement = document.getElementById('mediapipeOutput');
const canvasCtx = canvasElement.getContext('2d');

// Fungsi menggambar hasil MediaPipe ke canvas
function drawResults(results) {
    // console.log('Pose results received'); // Log saat hasil pose diterima
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // console.log('Pose landmarks detected:', results.poseLandmarks); // Log semua landmark yang terdeteksi
        // Contoh: Menggambar landmark
        for (const landmark of results.poseLandmarks) {
            const { x, y } = landmark;
            canvasCtx.beginPath();
            canvasCtx.arc(x * canvasElement.width, y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'red';
            canvasCtx.fill();
        }

       // Fungsi untuk menghitung rotasi pada lengan dengan dua vektor
        function calculateArmRotation(start, middle, end) {
            const deltaX = end.x - middle.x;
            const deltaY = end.y - middle.y;
            const angle = Math.atan2(deltaY, deltaX); // Menghitung sudut antara titik tengah dan titik akhir
            return angle; // Mengembalikan sudut rotasi
        }

        // Sinkronisasi pose ke tulang
        if (rightUpperArmBone && rightForeArmBone && rightHandBone && leftUpperArmBone && leftForeArmBone && leftHandBone) {
            console.log('Syncing landmarks to bones'); // Log proses sinkronisasi landmark ke tulang

            // Posisi landmark MediaPipe untuk masing-masing tangan
            const rightShoulder = results.poseLandmarks[12]; // Right Shoulder
            const rightElbow = results.poseLandmarks[14];   // Right Elbow
            const rightWrist = results.poseLandmarks[16];   // Right Wrist
            const leftShoulder = results.poseLandmarks[11]; // Left Shoulder
            const leftElbow = results.poseLandmarks[13];    // Left Elbow
            const leftWrist = results.poseLandmarks[15];    // Left Wrist

            // Rotasi Upper Arm kanan
            const upperArmAngleRight = calculateArmRotation(rightShoulder, rightElbow, rightWrist);
            rightUpperArmBone.rotation.z = upperArmAngleRight; // Menggunakan rotasi pada sumbu Z untuk perputaran horizontal

            console.log('Updated RightUpperArm rotation:', rightUpperArmBone.rotation.z);

            // Rotasi Forearm kanan
            const forearmAngleRight = calculateArmRotation(rightElbow, rightWrist, rightWrist); // Menyesuaikan posisi wrist
            rightForeArmBone.rotation.z = forearmAngleRight; // Rotasi pada sumbu Z

            console.log('Updated RightForeArm rotation:', rightForeArmBone.rotation.z);

            // Rotasi Hand kanan
            const handAngleRight = calculateArmRotation(rightWrist, rightWrist, rightWrist); // Hand menggunakan wrist sebagai referensi
            rightHandBone.rotation.z = handAngleRight;

            console.log('Updated RightHand rotation:', rightHandBone.rotation.z);

            // Rotasi Upper Arm kiri
            const upperArmAngleLeft = calculateArmRotation(leftShoulder, leftElbow, leftWrist);
            leftUpperArmBone.rotation.z = upperArmAngleLeft;

            console.log('Updated LeftUpperArm rotation:', leftUpperArmBone.rotation.z);

            // Rotasi Forearm kiri
            const forearmAngleLeft = calculateArmRotation(leftElbow, leftWrist, leftWrist);
            leftForeArmBone.rotation.z = forearmAngleLeft;

            console.log('Updated LeftForeArm rotation:', leftForeArmBone.rotation.z);

            // Rotasi Hand kiri
            const handAngleLeft = calculateArmRotation(leftWrist, leftWrist, leftWrist);
            leftHandBone.rotation.z = handAngleLeft;

            console.log('Updated LeftHand rotation:', leftHandBone.rotation.z);
        }
    }
}

// MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});
pose.onResults(drawResults);

// Kamera untuk MediaPipe
const cameraFeed = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480,
});
cameraFeed.start();
