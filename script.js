 // Sound Controller
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playClickSound() {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'triangle';
            // Randomize pitch slightly for realism
            osc.frequency.setValueAtTime(100 + Math.random() * 50, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
            
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        }

        // Configuration
        const DRUM_COUNT = 6;
        const FACE_HEIGHT = 80; // px
        const FACE_WIDTH = 50;  // px
        const FACES = 10;
        const ANGLE_PER_FACE = 360 / FACES;
        // Radius calculation: r = (h/2) / tan(18deg)
        const RADIUS = Math.round((FACE_HEIGHT / 2) / Math.tan(Math.PI / FACES)); 

        let count = 0;
        let drumRotations = new Array(DRUM_COUNT).fill(0); // Stores the current rotation angle for each drum
        let autoInterval = null;

        const stage = document.getElementById('counter-stage');

        // Initialize Drums
        function initDrums() {
            stage.innerHTML = '';
            
            for (let i = 0; i < DRUM_COUNT; i++) {
                // Wrapper for perspective
                const wrapper = document.createElement('div');
                wrapper.className = `perspective-container overflow-hidden relative bg-neutral-900 rounded border-y border-neutral-800 shadow-inner`;
                wrapper.style.width = `${FACE_WIDTH}px`;
                wrapper.style.height = `${FACE_HEIGHT}px`;

                // The rotating drum
                const drum = document.createElement('div');
                drum.className = 'drum-container w-full h-full absolute top-0 left-0 transition-transform duration-700 cubic-bezier(0.25, 1, 0.5, 1)';
                drum.id = `drum-${i}`;
                
                // Create faces
                for (let j = 0; j < FACES; j++) {
                    const face = document.createElement('div');
                    face.className = 'drum-face bg-neutral-800 text-white text-4xl digit-font border-t border-b border-neutral-700/50';
                    face.textContent = j;
                    
                    // Transform face to form the cylinder
                    // Rotate X axis, then translate Z out
                    // For odometer logic (0 goes UP, 1 comes from BOTTOM), 
                    // Face 1 should be "below" Face 0.
                    // Face 0 at 0deg. Face 1 at -36deg (visually below in 3D space relative to viewer center? No, negative rotateX brings bottom towards you).
                    // Let's stick to standard: Face j at -j * 36.
                    // If Face 1 is at -36. To bring it to 0, we rotate Drum by +36.
                    // Face 0 moves to +36 (Up). Perfect.
                    face.style.transform = `rotateX(${-j * ANGLE_PER_FACE}deg) translateZ(${RADIUS}px)`;
                    
                    drum.appendChild(face);
                }

                wrapper.appendChild(drum);
                
                // Add shading overlay
                const overlay = document.createElement('div');
                overlay.className = 'glass-overlay absolute inset-0 w-full h-full';
                wrapper.appendChild(overlay);

                stage.appendChild(wrapper);
            }
            
            updateDrums(0, false); // Initial render
        }

        // Update drum positions based on the number
        function updateDrums(newCount, animate = true) {
            // Clamp count to positive integers (optional, usually odometers don't go negative well physically)
            // But we can support it or just loop. Let's stick to positive modulo max.
            const maxVal = Math.pow(10, DRUM_COUNT) - 1;
            if (newCount < 0) newCount = maxVal;
            if (newCount > maxVal) newCount = 0;
            
            count = newCount;

            // Update each drum
            let tempCount = count;
            
            for (let i = DRUM_COUNT - 1; i >= 0; i--) {
                const digit = tempCount % 10;
                tempCount = Math.floor(tempCount / 10);
                
                const drum = document.getElementById(`drum-${i}`);
                
                // Calculate target rotation
                // The face for digit D is at rotation D * 36deg.
                // However, to show D, we need to rotate the drum by -D * 36deg.
                // We also need to handle the "infinite" scroll so we don't unwind.
                
                const currentRotation = drumRotations[i];
                
                // New Logic: 
                // Face j is at -j * 36.
                // To show Digit D, we want Face D at 0.
                // Current Face D position = (-D * 36) + DrumRotation.
                // We want (-D * 36) + DrumRotation = 0 (modulo 360).
                // So DrumRotation should be D * 36.
                
                let targetAngle = digit * ANGLE_PER_FACE;
                
                // We want to move smoothly from currentRotation to targetAngle.
                // Find k such that (targetAngle + k*360) is closest to currentRotation.
                
                // However, we must respect the "Odometer Direction".
                // 0 -> 1: Drum rotates +36. (Increment = Positive Delta)
                // 1 -> 2: Drum rotates +36.
                // 9 -> 0: Drum rotates +36.
                
                // If we use shortest path:
                // 9 (at 324) -> 0 (at 0 or 360).
                // 0 - 324 = -324. Shortest path is +36 (360 - 324). 
                // 360 is target.
                // So 324 -> 360 is +36. Correct.
                
                // 0 (at 0) -> 9 (at 324 or -36).
                // 324 - 0 = 324. Shortest path is -36.
                // -36 is target.
                // 0 -> -36 is -36. Correct (Decrement).
                
                // So Shortest Path logic still works perfectly!
                
                while (targetAngle - currentRotation > 180) targetAngle -= 360;
                while (targetAngle - currentRotation < -180) targetAngle += 360;
                
                // Force wrap consistency for 9<->0 to ensure it doesn't backflip if something is slightly off
                // But shortest path handles 9->0 as +36 and 0->9 as -36 properly.
                
                drumRotations[i] = targetAngle;
                
                if (animate) {
                    // Only play sound if this drum is actually moving
                    if (Math.abs(targetAngle - currentRotation) > 1) {
                         // Debounce sound per update frame (simplification: just play once per update call roughly, or per drum?)
                         // Per drum sounds messy. Let's play one click per updateDrums call if ANY drum moves.
                    }
                    
                    drum.style.transition = 'transform 0.6s cubic-bezier(0.15, 0.9, 0.35, 1.2)'; // Add a little bounce
                    drum.style.transform = `rotateX(${targetAngle}deg)`;
                } else {
                    drum.style.transition = 'none';
                    drum.style.transform = `rotateX(${targetAngle}deg)`;
                }
            }
            
            if (animate) playClickSound();
        }

        // Initialize
        initDrums();

        // Event Listeners
        document.getElementById('btn-inc').addEventListener('click', () => {
            updateDrums(count + 1);
        });

        document.getElementById('btn-dec').addEventListener('click', () => {
            updateDrums(count - 1);
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            updateDrums(0);
        });
        
        document.getElementById('btn-auto').addEventListener('click', (e) => {
            if (autoInterval) {
                clearInterval(autoInterval);
                autoInterval = null;
                e.target.textContent = "Auto Run";
                e.target.classList.remove('bg-green-700');
                e.target.classList.add('bg-neutral-700');
            } else {
                e.target.textContent = "Stop Auto";
                e.target.classList.remove('bg-neutral-700');
                e.target.classList.add('bg-green-700');
                autoInterval = setInterval(() => {
                    updateDrums(count + 1);
                }, 200);
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') updateDrums(count + 1);
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') updateDrums(count - 1);
        });
