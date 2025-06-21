<template>
    <div class="page-panel">
        <div
            class="page-panel--navigation"
            :class="{
                'tab-content-gutter': !detached,
                detached,
            }"
        >
            <button class="close" @click="closePagePanel()">
                <InterfaceDelete1 class="icon" />
            </button>
        </div>
        <div class="page-panel--tabs">
            <div class="page-panel--tabs--tab">
                <XRayTab v-if="links.length || backlinks.length">
                    <h3>Links</h3>
                    <XRayLinks
                        :parent-document="document"
                        :links="links"
                        :backlinks="backlinks"
                        :jira-links="$entities.page.getJiraLinks(document.id)"
                        :github-links="
                            $entities.page.getGithubLinks(document.id)
                        "
                        :linear-links="
                            $entities.page.getLinearLinks(document.id)
                        "
                    />
                </XRayTab>
                <XRayTab v-if="headings.length">
                    <h3>Outline</h3>
                    <XRayStructure
                        :headings="headings"
                        @heading:click="$emit('heading:click', $event)"
                    />
                </XRayTab>
                <XRayTab>
                    <h3>Properties</h3>
                    <XRayProperties :properties="properties" />
                </XRayTab>
                <XRayTab>
                    <h3>Location</h3>
                    <XRayLocation :page="document" :labels="labels" />
                </XRayTab>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Inject } from 'vue-property-decorator';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import { UniqueID } from '~/components/editor/extensions/unique-id';
import { IDocument } from '~/components/document/model';
import Task from '~/components/task/Task.vue';

import XRayTab from '~/components/x-ray/XRayTab.vue';
import XRayLinks from '~/components/x-ray/XRayLinks.vue';
import XRayStructure from '~/components/x-ray/XRayStructure.vue';

import XRayProperties from '~/components/x-ray/XRayProperties.vue';
import XRayLocation from '~/components/x-ray/XRayLocation.vue';

import InterfaceDelete1 from '~/components/streamline/InterfaceDelete1.vue';
import { TabSymbols } from '~/constants/symbols';

@Component({
    name: 'PagePanel',
    components: {
        InterfaceDelete1,
        XRayLocation,
        XRayProperties,
        XRayStructure,
        XRayLinks,
        XRayTab,
        Task,
    },
})
export default class PagePanel extends Vue {
    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Prop({ default: false })
    detached!: boolean;

    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    get document() {
        return (
            this.$store.getters['document/byId'](this.entityId) ??
            this.$store.getters['document/byClip'](this.entityId) ??
            null
        );
    }

    get propertiesMap() {
        return this.$entities.page.getPostprocessingMap(this.document.id);
    }

    get tabData() {
        return this.$store.getters['tabs/byId'](this.tabId)?.data;
    }

    get activeTab() {
        return this.tabData.activeTab || 'all';
    }

    get isDailyDoc() {
        if (!this.document) return false;
        return !!this.document?.dailyDoc;
    }

    get properties() {
        if (!this.document)
            return {
                createdAt: new Date(),
                updatedAt: new Date(),
            };

        return {
            createdAt: this.document.createdAt || new Date(),
            updatedAt: this.document.updatedAt || new Date(),
        };
    }

    get labels() {
        if (!this.propertiesMap) return [];

        return this.propertiesMap.labels;
    }

    get links() {
        if (!this.propertiesMap?.links) return [];

        return this.propertiesMap.links
            .map((link: string) => {
                return this.$store.getters['document/byId'](link);
            })
            .filter((doc: IDocument | null) => doc !== null);
    }

    get backlinks() {
        if (!this.document) return [];

        return this.$store.getters['document/backlinks'](this.document.id);
    }

    get headings() {
        if (!this.document?.content) return [];

        const headings = generateJSON(this.document.content, [
            StarterKit as any,
            UniqueID.configure({
                types: ['heading'],
            }),
        ])
            .content.filter(
                ({ type, ...h }: any) => type === 'heading' && h.content,
            )
            .map((h: any) => {
                return {
                    level: h.attrs.level,
                    id: h.attrs.id,
                    textContent: h.content.reduce(
                        (accumulator: string, curr: any) => {
                            return accumulator + curr.text;
                        },
                        '',
                    ),
                };
            }) as any[];

        if (this.document.title) {
            headings.unshift({
                level: 'title',
                id: 'title',
                textContent: this.document.title,
            });
        }

        return headings;
    }
    closePagePanel() {
        this.$emit('close');
        this.$store.dispatch('appSettings/updateEditorOptions', {
            showInfoPanel: false,
        });
    }
}
</script>

<style lang="scss" scoped>
.page-panel {
    @include scrollbar(68px, 9px);
    position: relative;
    overflow-y: overlay;
    overflow-x: hidden;
    height: 100%;

    &--navigation {
        position: sticky;
        top: 0;
        z-index: 2;

        padding: 18px 15px 12px;
        display: flex;
        align-items: center;
        justify-content: flex-start;

        -webkit-backdrop-filter: blur(12px); /* Safari 9+ */
        backdrop-filter: blur(12px); /* Chrome and Opera */
        border-bottom: 1px solid var(--tab-divider-color);

        &.detached {
            padding-top: 16px;
        }

        button {
            padding: 3px 13px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            line-height: 155.2%;
            color: var(--page-panel-header-button-color);
            outline: none;

            &.active,
            &:hover {
                background: var(--page-panel-header-button-bg-color__hover);
                color: var(--page-panel-header-button-color__hover);
            }

            &:not(:last-of-type) {
                margin-right: 6px;
            }

            &.close {
                color: var(--page-panel-header-button-close-color);
                padding: 7px;
                margin-right: 10px;

                &:hover {
                    color: var(--page-panel-header-button-color__hover);
                    background: none;
                }
            }
        }
    }

    &--tabs {
        padding: 8px 15px 12px;
    }
}
</style>
