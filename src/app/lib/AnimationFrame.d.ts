export default class AnimationFrame {
    /**
     * Replace the globally defined implementation or define it globally.
     *
     * @param {Object|Number} [options]
     * @api public
     */
    static shim(options?: any | number): AnimationFrame;
    /**
     * Crossplatform Date.now()
     *
     * @return {Number} time in ms
     * @api public
     */
    static now(): number;
    /**
     * Replacement for PerformanceTiming.navigationStart for the case when
     * performance.now is not implemented.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/PerformanceTiming.navigationStart
     *
     * @type {Number}
     * @api public
     */
    static get navigationStart(): number;
    /**
     * Crossplatform performance.now()
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/Performance.now()
     *
     * @return {Number} relative time in ms
     * @api public
     */
    static perfNow(): number;
    /**
     * Is native animation frame implemented. The right value is set during feature
     * detection step.
     *
     * @type {Boolean}
     * @api public
     */
    static get hasNative(): boolean;
    /**
     * Animation frame constructor.
     *
     * Options:
     *   - `useNative` use the native animation frame if possible, defaults to true
     *   - `frameRate` pass a custom frame rate
     *
     * @param {Object|Number} options
     */
    constructor(options?: any | number);
    options: any;
    frameRate: any;
    _frameLength: number;
    _isCustomFrameRate: boolean;
    _timeoutId: number;
    _callbacks: {};
    _lastTickTime: number;
    _tickCounter: number;
    /**
     * Request animation frame.
     * We will use the native RAF as soon as we know it does works.
     *
     * @param {Function} callback
     * @return {Number} timeout id or requested animation frame id
     * @api public
     */
    request(callback: Function): number;
    /**
     * Cancel animation frame.
     *
     * @param {Number} timeout id or requested animation frame id
     *
     * @api public
     */
    cancel(id: any): void;
}