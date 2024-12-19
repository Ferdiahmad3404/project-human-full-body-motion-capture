import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// Inisialisasi Three.js
let model;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// MediaPipe Setup
const videoElement = document.getElementById('cameraFeed');
const canvasElement = document.getElementById('mediapipeOutput');
const canvasCtx = canvasElement.getContext('2d');
const pose = new Pose({
    locateFile: (file) =>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
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

// Tambahkan pencahayaan
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(ambientLight);
scene.add(directionalLight);

// Muat model GLB
let rightUpperArmBone;  // Reference to right upper arm bone
let rightForeArmBone;   // Reference to right forearm bone
let rightHandBone;      // Reference to right hand bone
let leftUpperArmBone;   // Reference to left upper arm bone
let leftForeArmBone;    // Reference to left forearm bone
let leftHandBone;       // Reference to left hand bone
const loader = new GLTFLoader();
loader.load('src/human.glb', (gltf) => {
    console.log('Model loaded successfully'); // Log saat model berhasil dimuat
    model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }
        if (child.isBone) {
            // console.log(`Bone found: ${child.name}`); 
            if (child.name === 'upper_armR') rightUpperArmBone = child;
            if (child.name === 'forearmR') rightForeArmBone = child;
            if (child.name === 'handR') rightHandBone = child;
            if (child.name === 'upper_armL') leftUpperArmBone = child;
            if (child.name === 'forearmL') leftForeArmBone = child;
            if (child.name === 'handL') leftHandBone = child;
        }
    });
    scene.add(model);
    model.scale.set(3, 3, 3);
    model.position.set(0, -3, 0);
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// Atur posisi kamera
camera.position.z = 5;

// Fungsi animasi
const animate = function () {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
};
animate();

// Fungsi menggambar hasil MediaPipe ke canvas
function drawResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Menggambar titik landmark MediaPipe di canvas
        for (const landmark of results.poseLandmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(
                landmark.x * canvasElement.width,
                landmark.y * canvasElement.height,
                5,
                0,
                2 * Math.PI
            );
            canvasCtx.fillStyle = 'red';
            canvasCtx.fill();
        }
        
        function calculateUpperArmRotation(shoulder, elbow) {
            // Vektor arah dari shoulder ke elbow
            const direction = new THREE.Vector3(
                elbow.x - shoulder.x,
                elbow.y - shoulder.y,
                elbow.z - shoulder.z
            ).normalize();
        
            // Menggunakan referensi vektor yang lebih mendatar
            const referenceVector = new THREE.Vector3(-1, -1, 0); // Atur vektor referensi sesuai dengan T-Pose yang lebih mendatar
        
            // Hitung quaternion untuk rotasi dari referenceVector ke direction
            const quaternion = new THREE.Quaternion().setFromUnitVectors(referenceVector, direction);
        
            // Konversi quaternion ke Euler untuk diterapkan pada model
            const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
        
            // Terapkan batasan rotasi agar realistis
            const maxRotationY = THREE.MathUtils.degToRad(180);  // Maksimum 90 derajat
            const minRotationY = THREE.MathUtils.degToRad(-180); // Minimum -90 derajat
        
            const maxRotationZ = THREE.MathUtils.degToRad(180); // Maksimum 120 derajat
            const minRotationZ = THREE.MathUtils.degToRad(-180); // Minimum -30 derajat
        
            // Batasan rotasi pada sumbu Y dan Z
            rotation.y = THREE.MathUtils.clamp(rotation.y, minRotationY, maxRotationY);
            rotation.z = THREE.MathUtils.clamp(rotation.z, minRotationZ, maxRotationZ);
            rotation.z = -rotation.z; // Invert Z rotation agar sesuai
        
            return rotation;
        }
        
        function applyUpperArmRotation(results) {
            if (!rightUpperArmBone || !results.poseLandmarks) return;
        
            const rightElbow = results.poseLandmarks[14]; // Right Elbow
            const rightShoulder = results.poseLandmarks[12]; // Right Shoulder
        
            // Hitung rotasi
            const upperArmRotation = calculateUpperArmRotation(rightShoulder, rightElbow);
        
            // Terapkan rotasi hanya pada sumbu yang relevan
            rightUpperArmBone.rotation.y = upperArmRotation.y; // Sumbu Y
            rightUpperArmBone.rotation.z = upperArmRotation.z; // Sumbu Z
        }

        function applyForearmRotation(results) {
            if (!rightForeArmBone || !rightUpperArmBone || !results.poseLandmarks) return;
        
            const rightElbow = results.poseLandmarks[14];  // Right Elbow
            const rightWrist = results.poseLandmarks[16];  // Right Wrist
        
            // Ambil quaternion global dari upper arm
            const upperArmGlobalQuaternion = new THREE.Quaternion();
            rightUpperArmBone.getWorldQuaternion(upperArmGlobalQuaternion);
        
            // Transformasikan referensi forearm dengan quaternion global upper arm
            const transformedReferenceVector = new THREE.Vector3(-1, -0.5, -1).applyQuaternion(upperArmGlobalQuaternion);
        
            // Hitung arah forearm
            const forearmDirection = new THREE.Vector3(
                rightWrist.x - rightElbow.x,
                rightWrist.y - rightElbow.y,
                rightWrist.z - rightElbow.z
            ).normalize();
        
            // Hitung rotasi forearm berdasarkan referensi yang ditransformasikan
            const forearmQuaternion = new THREE.Quaternion().setFromUnitVectors(
                transformedReferenceVector,
                forearmDirection
            );
        
            // Konversikan ke rotasi Euler
            const forearmRotation = new THREE.Euler().setFromQuaternion(forearmQuaternion, 'XYZ');
        
            // Terapkan rotasi pada forearm
            rightForeArmBone.rotation.x = forearmRotation.x;
            rightForeArmBone.rotation.y = forearmRotation.y;
            // rightForeArmBone.rotation.z = forearmRotation.z;
        }
        

        function calculateUpperArmRotationLeft(shoulder, elbow) {
            // Vektor arah dari shoulder ke elbow untuk lengan kiri
            const direction = new THREE.Vector3(
                elbow.x - shoulder.x,
                elbow.y - shoulder.y,
                elbow.z - shoulder.z
            ).normalize();
        
            // Membalikkan referensi vektor untuk lengan kiri
            const referenceVector = new THREE.Vector3(1, -1, 0); // Inversi pada sumbu X untuk lengan kiri
        
            // Hitung quaternion untuk rotasi dari referenceVector ke direction
            const quaternion = new THREE.Quaternion().setFromUnitVectors(referenceVector, direction);
        
            // Konversi quaternion ke Euler untuk diterapkan pada model
            const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
        
            // Terapkan batasan rotasi agar realistis
            const maxRotationY = THREE.MathUtils.degToRad(180);  // Maksimum 90 derajat
            const minRotationY = THREE.MathUtils.degToRad(-180); // Minimum -90 derajat
        
            const maxRotationZ = THREE.MathUtils.degToRad(180); // Maksimum 120 derajat
            const minRotationZ = THREE.MathUtils.degToRad(-180); // Minimum -30 derajat
        
            // Batasan rotasi pada sumbu Y dan Z
            rotation.y = THREE.MathUtils.clamp(rotation.y, minRotationY, maxRotationY);
            rotation.z = THREE.MathUtils.clamp(rotation.z, minRotationZ, maxRotationZ);
            rotation.z = -rotation.z; // Invert Z rotation agar sesuai
        
            return rotation;
        }
        
        function applyUpperArmRotationLeft(results) {
            if (!leftUpperArmBone || !results.poseLandmarks) return;
        
            const leftElbow = results.poseLandmarks[13]; // Left Elbow
            const leftShoulder = results.poseLandmarks[11]; // Left Shoulder
        
            // Hitung rotasi dengan referensi vektor yang sudah dibalik
            const upperArmRotation = calculateUpperArmRotationLeft(leftShoulder, leftElbow);
        
            // Terapkan rotasi dengan inversi pada sumbu yang relevan
            leftUpperArmBone.rotation.y = upperArmRotation.y; // Inversi sumbu Y
            leftUpperArmBone.rotation.z = upperArmRotation.z; // Inversi sumbu Z
        }
        
        function applyForearmRotationLeft(results) {
            if (!leftForeArmBone || !leftUpperArmBone || !results.poseLandmarks) return;
        
            const leftElbow = results.poseLandmarks[13];  // Left Elbow
            const leftWrist = results.poseLandmarks[15];  // Left Wrist
        
            // Ambil quaternion global dari upper arm
            const upperArmGlobalQuaternion = new THREE.Quaternion();
            leftUpperArmBone.getWorldQuaternion(upperArmGlobalQuaternion);
        
            // Transformasikan referensi forearm dengan quaternion global upper arm
            const transformedReferenceVector = new THREE.Vector3(1, -0.5, -1).applyQuaternion(upperArmGlobalQuaternion);  // Inversi pada sumbu X untuk forearm kiri
        
            // Hitung arah forearm
            const forearmDirection = new THREE.Vector3(
                leftWrist.x - leftElbow.x,
                leftWrist.y - leftElbow.y,
                leftWrist.z - leftElbow.z
            ).normalize();
        
            // Hitung rotasi forearm berdasarkan referensi yang ditransformasikan
            const forearmQuaternion = new THREE.Quaternion().setFromUnitVectors(
                transformedReferenceVector,
                forearmDirection
            );
        
            // Konversikan ke rotasi Euler
            const forearmRotation = new THREE.Euler().setFromQuaternion(forearmQuaternion, 'XYZ');
        
            // Terapkan rotasi dengan inversi
            leftForeArmBone.rotation.x = forearmRotation.x;
            leftForeArmBone.rotation.y = forearmRotation.y; // Inversi sumbu YS
        }     
        
        // Tambahkan di dalam drawResults()
        if (results.poseLandmarks) {
            applyUpperArmRotation(results);
            applyForearmRotation(results);

             // Tambahkan untuk lengan kiri
            applyUpperArmRotationLeft(results);
            applyForearmRotationLeft(results);
        }        
    }
}