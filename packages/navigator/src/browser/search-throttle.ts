/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { Event, Emitter } from '@theia/core/lib/common/event';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';

/**
 * Options for the search term throttle.
 */
@injectable()
export class SearchThrottleOptions {

    /**
     * The delay (in milliseconds) before the throttle notifies clients about its content change.
     */
    readonly delay: number;

}

export namespace SearchThrottleOptions {

    /**
     * The default throttle option.
     */
    export const DEFAULT: SearchThrottleOptions = {
        delay: 50
    };

}

/**
 * The search term throttle. It notifies clients if the underlying search term has changed after a given
 * amount of delay.
 */
@injectable()
export class SearchThrottle implements Disposable {

    protected readonly disposables = new DisposableCollection();
    protected readonly emitter = new Emitter<string | undefined>();

    protected timer: number | undefined;
    protected state: string | undefined;

    constructor(@inject(SearchThrottleOptions) protected readonly options: SearchThrottleOptions) {
        this.disposables.push(this.emitter);
    }

    append(input: string | undefined): string | undefined {
        if (input === undefined) {
            this.reset();
            return undefined;
        }
        this.clearTimer();
        if (this.state === undefined) {
            this.state = input;
        } else {
            if (input === '\b') {
                this.state = this.state.length === 1 ? '' : this.state.substr(0, this.state.length - 1);
            } else {
                this.state += input;
            }
        }
        this.timer = window.setTimeout(() => this.fireChanged(this.state), this.options.delay);
        return this.state;
    }

    get onChanged(): Event<string | undefined> {
        return this.emitter.event;
    }

    dispose(): void {
        this.disposables.dispose();
    }

    protected fireChanged(value: string | undefined) {
        this.clearTimer();
        this.emitter.fire(value);
    }

    protected clearTimer() {
        if (this.timer) {
            window.clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    protected reset() {
        this.state = undefined;
        this.fireChanged(undefined);
    }

}
