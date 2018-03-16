/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { Resource, ResourceResolver, Emitter, Event, DisposableCollection, ReferenceCollection, MaybePromise } from "@theia/core";
import URI from "@theia/core/lib/common/uri";
import { FileSystem, FileStat } from "../common/filesystem";
import { FileSystemWatcher } from "./filesystem-watcher";

export class FileResource implements Resource {

    protected readonly toDispose = new DisposableCollection();
    protected readonly onDidChangeContentsEmitter = new Emitter<void>();
    readonly onDidChangeContents: Event<void> = this.onDidChangeContentsEmitter.event;

    protected state: Promise<FileResource.State> = FileResource.emptyState;
    protected uriString: string;

    constructor(
        readonly uri: URI,
        protected readonly fileSystem: FileSystem,
        protected readonly fileSystemWatcher: FileSystemWatcher
    ) {
        this.uriString = this.uri.toString();
        this.toDispose.push(this.onDidChangeContentsEmitter);
    }

    async init(): Promise<void> {
        const fileStat = await this.getFileStat();
        if (fileStat && fileStat.isDirectory) {
            throw new Error('The given uri is a directory: ' + this.uriString);
        }
        this.state = this.read();
        await this.state;
        this.toDispose.push(await this.fileSystemWatcher.watchFileChanges(this.uri));
        this.toDispose.push(this.fileSystemWatcher.onFilesChanged(changes => {
            if (changes.some(e => e.uri.toString() === this.uriString)) {
                this.sync();
            }
        }));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async readContents(): Promise<string> {
        const { content } = await this.state;
        return content;
    }

    async saveContents(content: string): Promise<void> {
        await this.setState(current => this.write(current, content));
    }

    protected async sync(): Promise<void> {
        await this.setState(async current => {
            if (await this.isInSync(current.stat)) {
                return current;
            }
            this.onDidChangeContentsEmitter.fire(undefined);
            return this.fileSystem.resolveContent(this.uriString);
        });
    }
    protected async isInSync(current?: FileStat): Promise<boolean> {
        const stat = await this.getFileStat();
        if (!current) {
            return !stat;
        }
        return !!stat && current.lastModification >= stat.lastModification;
    }

    protected read(): Promise<FileResource.State> {
        return this.fileSystem.resolveContent(this.uriString);
    }
    protected async write(current: FileResource.State, content: string): Promise<FileResource.State> {
        const stat = await this.getFileStat();
        if (stat) {
            await this.fileSystem.setContent(stat, content);
        } else {
            await this.fileSystem.createFile(this.uriString, { content });
        }
        return { stat, content };
    }

    protected async getFileStat(): Promise<FileStat | undefined> {
        if (!this.fileSystem.exists(this.uriString)) {
            return undefined;
        }
        try {
            return this.fileSystem.getFileStat(this.uriString);
        } catch {
            return undefined;
        }
    }

    protected setState(fn: (current: FileResource.State) => MaybePromise<FileResource.State>): Promise<FileResource.State> {
        return this.state = this.state.then(async current => {
            try {
                return await fn(current);
            } catch (e) {
                console.error(e);
                return current;
            }
        });
    }

}
export namespace FileResource {
    export interface State {
        readonly stat?: FileStat,
        readonly content: string
    }
    export const emptyState: Promise<State> = Promise.resolve(Object.freeze({ content: '' }));
}

@injectable()
export class FileResourceResolver implements ResourceResolver {

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(FileSystemWatcher)
    protected readonly fileSystemWatcher: FileSystemWatcher;

    protected readonly resources = new ReferenceCollection<string, FileResource>(
        uri => this.create(uri)
    );

    async resolve(uri: URI): Promise<FileResource> {
        if (uri.scheme !== 'file') {
            throw new Error('The given uri is not file uri: ' + uri);
        }
        const { object } = await this.resources.acquire(uri.toString());
        return object;
    }

    protected async create(uriString: string): Promise<FileResource> {
        const uri = new URI(uriString);
        const resource = new FileResource(uri, this.fileSystem, this.fileSystemWatcher);
        await resource.init();
        return resource;
    }

}
