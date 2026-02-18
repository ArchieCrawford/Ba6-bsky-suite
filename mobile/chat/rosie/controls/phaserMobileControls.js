/**
 * Phaser Mobile Controls - Touch controls for 2D Phaser games
 * Import and use in your GameScene
 */

/**
 * VirtualJoystick - Fixed position joystick for movement
 */
class VirtualJoystick {
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.baseRadius = options.baseRadius || 60;
        this.knobRadius = options.knobRadius || 30;
        this.maxDistance = options.maxDistance || 50;

        // Create joystick graphics
        this.base = scene.add.circle(x, y, this.baseRadius, 0x888888, 0.5);
        this.knob = scene.add.circle(x, y, this.knobRadius, 0xffffff, 0.8);

        // Set depth to be above game elements
        this.base.setDepth(1000);
        this.knob.setDepth(1001);

        // Fix to screen (don't scroll with camera)
        this.base.setScrollFactor(0);
        this.knob.setScrollFactor(0);

        // Movement vector (-1 to 1)
        this.vector = { x: 0, y: 0 };

        // Track active pointer
        this.activePointer = null;

        this.setupInput();
    }

    setupInput() {
        // Only respond to touches on left half of screen
        this.scene.input.on('pointerdown', (pointer) => {
            if (pointer.x < this.scene.scale.width / 2 && !this.activePointer) {
                this.activePointer = pointer;
            }
        });

        this.scene.input.on('pointermove', (pointer) => {
            if (this.activePointer && pointer.id === this.activePointer.id) {
                const dx = pointer.x - this.base.x;
                const dy = pointer.y - this.base.y;
                const distance = Math.min(Math.sqrt(dx * dx + dy * dy), this.maxDistance);
                const angle = Math.atan2(dy, dx);

                // Move knob
                this.knob.setPosition(
                    this.base.x + Math.cos(angle) * distance,
                    this.base.y + Math.sin(angle) * distance
                );

                // Update vector
                this.vector.x = (distance / this.maxDistance) * Math.cos(angle);
                this.vector.y = (distance / this.maxDistance) * Math.sin(angle);
            }
        });

        this.scene.input.on('pointerup', (pointer) => {
            if (this.activePointer && pointer.id === this.activePointer.id) {
                this.activePointer = null;
                this.knob.setPosition(this.base.x, this.base.y);
                this.vector = { x: 0, y: 0 };
            }
        });
    }

    getVector() {
        return this.vector;
    }

    destroy() {
        this.base.destroy();
        this.knob.destroy();
    }
}

/**
 * ActionButton - Touch button for actions (jump, shoot, etc.)
 */
class ActionButton {
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.radius = options.radius || 50;
        this.color = options.color || 0x4444ff;
        this.label = options.label || '';
        this.onPress = options.onPress || (() => {});
        this.onRelease = options.onRelease || (() => {});

        // Create button
        this.button = scene.add.circle(x, y, this.radius, this.color, 0.7);
        this.button.setDepth(1000);
        this.button.setScrollFactor(0);  // Fix to screen
        this.button.setInteractive();

        // Add label if provided
        if (this.label) {
            this.text = scene.add.text(x, y, this.label, {
                fontSize: '24px',
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);
        }

        this.setupInput();
    }

    setupInput() {
        this.button.on('pointerdown', () => {
            this.button.setScale(0.9);
            this.button.setAlpha(1);
            this.onPress();
        });

        this.button.on('pointerup', () => {
            this.button.setScale(1);
            this.button.setAlpha(0.7);
            this.onRelease();
        });

        this.button.on('pointerout', () => {
            this.button.setScale(1);
            this.button.setAlpha(0.7);
            this.onRelease();
        });
    }

    destroy() {
        this.button.destroy();
        if (this.text) this.text.destroy();
    }
}

/**
 * MobileControlsManager - Manages all mobile controls for a scene
 */
class MobileControlsManager {
    constructor(scene) {
        this.scene = scene;
        this.joystick = null;
        this.buttons = [];

        // Safe margins (percentage-based)
        const { width, height } = scene.scale;
        this.safeBottom = height * 0.04;
        this.safeSides = width * 0.03;
    }

    addJoystick(options = {}) {
        const { width, height } = this.scene.scale;
        const x = options.x || this.safeSides + 100;
        const y = options.y || height - this.safeBottom - 100;

        this.joystick = new VirtualJoystick(this.scene, x, y, options);
        return this.joystick;
    }

    addButton(options = {}) {
        const { width, height } = this.scene.scale;
        const x = options.x || width - this.safeSides - 80;
        const y = options.y || height - this.safeBottom - 80;

        const button = new ActionButton(this.scene, x, y, options);
        this.buttons.push(button);
        return button;
    }

    getMovement() {
        return this.joystick ? this.joystick.getVector() : { x: 0, y: 0 };
    }

    destroy() {
        if (this.joystick) this.joystick.destroy();
        this.buttons.forEach(b => b.destroy());
    }
}

export { VirtualJoystick, ActionButton, MobileControlsManager };