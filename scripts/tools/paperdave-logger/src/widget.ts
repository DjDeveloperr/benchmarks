//import { writeSync } from 'fs';
import { ansi } from './ansi';
import { fail, success } from './log';
import type { Timer } from './util';
import { STDOUT } from './util';

const widgets: LogWidget[] = [];
let widgetLineCount = 0;
let widgetTimer: Timer | undefined;
let widgetDrawingDisabled = false;

/**
 * A Log Widget is a piece of log content that is held at the bottom of the console log, and can be
 * animated/dynamically updated. It is used to create spinners, progress bars, and other rich visuals.
 */
export abstract class LogWidget {
  constructor() {
    widgets.push(this);

    if (!widgetTimer) {
      widgetTimer = setInterval(redrawWidgets, 1000 / 60);
      // [PATCH] use console.log
      console.log(ansi.hide);
    }
  }

  /**
   * Returns a string of what the widget looks like. Called 15 times per second to allow for smooth
   * animation. The value passed to now is the result of `performance.now`.
   */
  protected abstract format(now: number): string;
  /**
   * The current FPS of the widget. If this is set to 0, the widget will not automatically update,
   * and you must call `update`.
   */
  protected abstract fps: number;

  /** Removes this widget from the log. */
  protected remove(finalMessage?: string) {
    const index = widgets.indexOf(this);
    if (index >= 0) {
      widgets.splice(index, 1);
    }
    clearWidgets();
    if (finalMessage) {
      // [PATCH] use console.log
      console.log(finalMessage);
    }
    if (widgets.length === 0) {
      clearInterval(widgetTimer);
      widgetTimer = undefined;
      // [PATCH] use console.log
      console.log(ansi.show);
    } else {
      redrawWidgets();
    }
  }

  /** Forces a redraw to happen immediately. */
  protected redraw() {
    this.#nextUpdate = 0;
    redrawWidgets();
  }

  #nextUpdate = 0;
  #text = '';
  #newlines = 0;

  /** @internal */
  private __internalUpdate(now: number) {
    if (now > this.#nextUpdate) {
      this.#nextUpdate = this.fps === 0 ? Infinity : now + 1000 / this.fps;
      const text = this.format(now);
      if (text !== this.#text) {
        this.#text = text + '\n';
        this.#newlines = text.split('\n').length;
      }
      return true;
    }
    return false;
  }

  /** @interal */
  private __internalGetText() {
    widgetLineCount += this.#newlines;
    return this.#text;
  }

  /**
   * Runs the given function without redrawing anything, then runs a redraws. This is used to batch
   * some updates together without having to redraw the current widgets more than once per frame.
   */
  static batchRedraw(fn: () => void) {
    widgetDrawingDisabled = true;
    fn();
    widgetDrawingDisabled = false;
    redrawWidgets();
  }

  /** Remove this widget with a success message. */
  success(message: string) {
    LogWidget.batchRedraw(() => {
      success(message);
      this.remove();
    });
  }

  /** Remove this widget with a failure message. */
  fail(message: string | Error) {
    LogWidget.batchRedraw(() => {
      fail(message);
      this.remove();
    });
  }
}

export function clearWidgets() {
  if (widgetLineCount) {
    // [PATCH] use console.log
    console.log(
      ansi.clearLine + (ansi.up(1) + ansi.clearLine).repeat(widgetLineCount)
    );
    widgetLineCount = 0;
  }
}

export function redrawWidgets() {
  if (!widgetTimer || widgetDrawingDisabled) {
    return;
  }

  const now = performance.now();
  const hasUpdate = widgets.filter(widget => widget['__internalUpdate'](now)).length > 0;

  if (hasUpdate || widgetLineCount === 0) {
    clearWidgets();
    // [PATCH] use console.log
    console.log(widgets.map(widget => widget['__internalGetText']()).join(''));
  }
}
