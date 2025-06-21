<template>
    <node-view-wrapper draggable="true" data-drag-handle>
        <tippy
            :content="$utils.tooltip.getRefText"
            :delay="[300, 20]"
            :touch="false"
            boundary="window"
            placement="top"
            theme="tooltip"
            target=".has-tippy"
        />
        <div :ref="`editor-image-${imageId}`" class="editor-image-wrapper">
            <div
                class="editor-image"
                :class="{
                    selected: isActive,
                    loading: node.attrs.loading,
                    'read-only': !editor.isEditable,
                }"
                :style="{
                    width: wrapperWidth,
                }"
                @dblclick="handleDoubleClick"
                @contextmenu.stop.prevent="handleContextMenu"
            >
                <div
                    class="editor-image__resizing-wrapper"
                    :style="{
                        width: currentWidth,
                        'pointer-events': isDragging ? 'none' : 'auto',
                    }"
                >
                    <img
                        ref="image"
                        :src="src"
                        width="100%"
                        @load="handleImageLoad"
                        @error="handleImageError"
                    />
                    <div
                        v-if="!$utils.isMobile"
                        ref="resizeHandle"
                        class="editor-image__resize-handle"
                        :class="{ show: isDragging }"
                        @mousedown="registerListeners"
                    ></div>
                    <div v-if="!$utils.isMobile" class="editor-image__controls">
                        <button
                            class="has-tippy"
                            :data-tippy-content="`<div class='tooltip'>View image</div>`"
                            @click.stop.prevent="handleOpenImage"
                        >
                            <InterfaceArrowsExpand3Alternate size="14" />
                        </button>
                        <button
                            class="has-tippy"
                            :data-tippy-content="`<div class='tooltip'>Download image</div>`"
                            @click.stop.prevent="handleDownloadImage"
                        >
                            <InterfaceDownloadButton2 size="14" />
                        </button>
                        <button
                            class="has-tippy"
                            :data-tippy-content="`<div class='tooltip'>Compy image to clipboard</div>`"
                            @click.stop.prevent="handleCopyToClipboard"
                        >
                            <InterfaceFileClipboard size="14" />
                        </button>
                    </div>
                    <div
                        v-if="node.attrs.loading && loaded"
                        class="editor-image__loading-wrapper"
                    >
                        <LoadingIcon />
                    </div>
                </div>
            </div>
        </div>
    </node-view-wrapper>
</template>

<script lang="ts">
import { nodeViewProps, NodeViewProps, NodeViewWrapper } from '@tiptap/vue-2';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { saveAs } from 'file-saver';
import { ImageContextMenu } from '~/components/context-menu';
import { ImageObject, IVault } from '~/@types';
import {
    CloudServiceAction,
    DatabaseServiceAction,
    ServiceKey,
} from '~/constants';
import { base64ImageToDataUrl } from '~/helpers/image';
import { throttle } from '~/helpers';
import LoadingIcon from '~/components/icons/LoadingIcon.vue';
import InterfaceDownloadButton2 from '~/components/streamline/InterfaceDownloadButton2.vue';
import InterfaceArrowsExpand3Alternate from '~/components/streamline/InterfaceArrowsExpand3Alternate.vue';
import InterfaceFileClipboard from '~/components/streamline/InterfaceFileClipboard.vue';

const throttledByFps = throttle(requestAnimationFrame);

@Component({
    name: 'ImageComponent',
    components: {
        InterfaceFileClipboard,
        InterfaceArrowsExpand3Alternate,
        InterfaceDownloadButton2,
        LoadingIcon,
        NodeViewWrapper,
    },
    props: nodeViewProps,
})
export default class ImageComponent extends Vue {
    editorHasFocus?: boolean = false;
    isActive?: boolean = false;
    src: string = '';
    hasInvalidToken = false;
    loaded = false;
    node!: NodeViewProps['node'];
    editor!: NodeViewProps['editor'];
    getPos!: NodeViewProps['getPos'];
    updateAttributes!: NodeViewProps['updateAttributes'];

    isDragging: boolean = false;
    temporaryWidth?: number | null = null;

    $refs!: {
        resizeHandle: HTMLDivElement;
        image: HTMLImageElement;
    } & Record<string, any>;

    get credentials() {
        return this.$store.getters['user/credentials'];
    }

    get imageId() {
        return this.node?.attrs.id;
    }

    get image() {
        return this.$store.getters['image/byId'](this.imageId) as ImageObject;
    }

    get activeVault(): IVault {
        return this.$store.getters['vault/active'];
    }

    get isLocalImage() {
        return (
            this.activeVault.filepath &&
            this.image?.filepath &&
            this.image?.isOnDisk
        );
    }

    get isRemoteImage() {
        return this.activeVault.type === 'remote' && this.image?.remoteUri;
    }

    get isEncryptedImage() {
        return (
            this.$encryption.isEnabled &&
            (this.image.encrypted || this.image.encryptionKey)
        );
    }

    get localImageSource() {
        return 'file://' + this.image.filepath;
    }

    get remoteImageSource() {
        if (!this.image) return null;
        const accessToken =
            this.$store.getters['user/credentials']?.accessToken;
        return this.image.remoteUri + `?token=${accessToken}`;
    }

    handleImageError(e: Event) {
        console.log('Image error', e);
    }

    handleImageLoad(e: Event) {
        this.loaded = true;
        this.updateAttributes({ loading: false });
    }

    handleOpenImage() {
        this.$vfm.show({
            component: () => import('@/components/modal/ImageModal.vue'),
            bind: {
                src: this.src,
            },
        });
    }

    handleCopyToClipboard() {
        const ext = `image/${this.image?.ext}` ?? 'image/png';
        const imgElement = this.$refs.image;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to image size
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;

        ctx?.drawImage(
            imgElement,
            0,
            0,
            imgElement.naturalWidth,
            imgElement.naturalHeight,
        );

        canvas.toBlob(blob => {
            // Use the Clipboard API to copy the image
            (navigator.clipboard as any)
                // @ts-ignore
                .write([new ClipboardItem({ [ext]: blob })])
                .then(() => {
                    this.$notification.show({
                        component: () =>
                            import(
                                '@/components/notifications/MiscNotification.vue'
                            ),
                        bind: {
                            displayText: 'Copied image to clipboard',
                        },
                    });
                })
                .catch((err: any) =>
                    console.error('Error copying image: ', err),
                );
        }, 'image/png');
    }

    handleDownloadImage() {
        saveAs(this.src);
    }

    async setSrc() {
        this.src = await this.getSource();
    }

    async getSource() {
        if (this.isLocalImage) {
            this.updateAttributes({ loading: false });
            return this.localImageSource;
        }
        if (this.isRemoteImage) {
            if (this.isEncryptedImage) {
                this.updateAttributes({ loading: false });
                return await this.retieveEncryptedImage();
            }
            this.updateAttributes({ loading: false });
            return this.remoteImageSource;
        }
        if (this.image?.data) {
            return this.image.data;
        }
        return this.node?.attrs.src;
    }

    async retieveEncryptedImage() {
        const base64Image = await this.$serviceRegistry.invoke<string>(
            ServiceKey.DATABASE,
            DatabaseServiceAction.RETRIEVE_DECRYPTED_IMAGE,
            {
                vaultId: this.image.vaultId,
                payload: {
                    vaultId: this.image.vaultId,
                    entity: this.image,
                },
                callerContext: 'ImageComponent.vue retieveEncryptedImage',
            },
        );
        if (!base64Image) return;

        const type = this.image.ext ?? 'png';
        return base64ImageToDataUrl(base64Image, type);
    }

    handleContextMenu(event: MouseEvent) {
        this.$contextMenu.show(event, {
            component: ImageContextMenu,
            bind: {
                src: this.src,
            },
        });
    }

    handleDoubleClick() {
        if (this.$utils.isMobile) return;
        this.$vfm.show({
            component: () => import('~/components/modal/ImageModal.vue'),
            bind: {
                src: this.src,
            },
        } as any);
    }

    isElementSelected() {
        const selection = this.editor?.state.selection;
        if (!selection) return false;
        const { from, to } = selection;
        const pos = this.getPos?.();
        if (pos === undefined) return false;
        return pos >= from && pos < to;
    }

    @Watch('credentials')
    handleCredentialsChange() {
        const activeVault = this.$store.getters['vault/active'];
        if (!this.hasInvalidToken || activeVault.type === 'local') return;
        this.hasInvalidToken = false;
        this.setSrc();
    }

    @Watch('image')
    handleImageChange() {
        this.setSrc();
    }

    get wrapperWidth() {
        if (this.node?.attrs.width && !this.temporaryWidth) {
            return `${this.node?.attrs.width}px`;
        }
        return 'fit-content';
    }

    get currentWidth() {
        if (this.temporaryWidth) {
            return `${this.temporaryWidth}px`;
        }
        if (this.node?.attrs.width) {
            return `${this.node?.attrs.width}px`;
        }
        return '100%';
    }

    registerListeners(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const wrapperX =
            this.$refs[`editor-image-${this.imageId}`].getBoundingClientRect()
                .x;
        const wrapperWidth =
            this.$refs[`editor-image-${this.imageId}`].getBoundingClientRect()
                .width;

        const onMouseMove = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.isDragging = true;
            throttledByFps(() => {
                if (event.target === this.$refs.resizeHandle) return;
                const newWidth = event.clientX - wrapperX;
                this.temporaryWidth = Math.min(
                    Math.max(newWidth, 150),
                    wrapperWidth,
                );
            });
        };
        const onMouseUp = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            this.isDragging = false;
            this.updateAttributes({
                width: this.temporaryWidth,
            });

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.temporaryWidth = null;
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    mounted() {
        const activeVault = this.$store.getters['vault/active'];
        const credentials = this.credentials;
        const user = this.$store.getters['user/user'];

        if (
            activeVault.type !== 'local' &&
            new Date(credentials.expiresAt).getTime() < Date.now() - 5 * 1_000
        ) {
            this.hasInvalidToken = true;
            this.$serviceRegistry.emit(
                ServiceKey.CLOUD,
                CloudServiceAction.REFRESH_CREDENTIALS,
                { userId: user.id, credentials },
            );
        }
        this.setSrc();

        this.editorHasFocus = this.editor?.view.hasFocus();
        this.editor?.on('focus', () => {
            this.isActive = this.isElementSelected();
        });
        this.editor?.on('blur', () => {
            this.isActive = false;
        });
        this.editor?.on('selectionUpdate', () => {
            this.isActive = this.isElementSelected();
        });
        this.isActive = this.isElementSelected();
    }

    beforeMount() {
        if (this.node.attrs.data) {
            this.src = this.node.attrs.data;
        }
    }
}
</script>
<style scoped lang="scss">
.editor-image-wrapper {
    width: 100%;
    pointer-events: none;
}

.editor-image {
    position: relative;
    margin: 6px 0px;

    &__loading-wrapper {
        z-index: 1;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    img {
        border-radius: 4px;
    }

    &.loading {
    }

    &:hover:not(.read-only) {
        .editor-image__resize-handle {
            visibility: visible;
        }

        .editor-image__controls {
            visibility: visible;
        }
    }

    &.selected {
        outline: var(--editor-extension-image-bg-color__active) 2px solid;
        outline-offset: 2px;
        border-radius: 4px;
    }

    &.loading {
        outline: var(--editor-extension-image-border-color__loading) 1px solid;
        outline-offset: 2px;
        border-radius: 4px;
        &::after {
            content: '';
            border-radius: 4px;
            display: block;
            position: absolute;
            background: var(--editor-extension-image-bg-color__loading);
            height: 100%;
            width: 100%;
            top: 0;
        }
    }

    &__resizing-wrapper {
        position: relative;
    }

    &__controls {
        @include frostedGlassBackground;
        position: absolute;
        top: 6px;
        right: 6px;
        visibility: hidden;
        border-radius: 4px;
        padding: 4px 6px;
        display: flex;
        align-items: center;
        gap: 6px;

        button {
            padding: 2px;
            color: var(--editor-extension-image-controls-icon-color);

            &:hover {
                color: var(--context-menu-button-icon-color__hover);
            }
        }
    }

    &__resize-handle {
        position: absolute;
        width: 6px;
        height: 50px;
        cursor: col-resize;
        top: 50%;
        left: calc(100% - 12px);
        transform: translateY(-50%);
        visibility: hidden;
        border: 1px solid var(--app-bg-icon-color);
        border-radius: 3px;
        background: var(--app-bg-color);

        &.show {
            visibility: visible;
        }
    }
}
</style>
