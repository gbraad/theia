/*
 * Copyright (C) 2018 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import {injectable, inject} from "inversify";
import {ILogger} from '@theia/core';
import {Debug} from "../common/debug-model";

/**
 * Debug implementation.
 */
@injectable()
export class DebugImpl implements Debug {
    @inject(ILogger)
    protected readonly logger: ILogger;

    dispose(): void {
    }

    doSomething(param: string): void {
        this.logger.info(param);
    }
}
