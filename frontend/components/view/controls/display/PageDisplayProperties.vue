<template>
    <div class="page-display-properties">
        <button
            v-for="property of properties"
            :key="property"
            class="page-display-properties__property"
            :class="{ selected: selected.includes(property) }"
            @click="updateDisplayProperties(property)"
        >
            {{ property }}
        </button>
    </div>
</template>
<script lang="ts">
import { Component, Inject, Prop, Vue } from 'vue-property-decorator';
import { PageListType } from '~/constants';
import { PageListSymbols } from '~/constants/symbols';

@Component({
    name: 'PageDisplayProperties',
})
export default class PageDisplayProperties extends Vue {
    @Prop({})
    entityId!: string;

    @Inject(PageListSymbols.TYPE)
    pageListType!: PageListType;

    @Prop({})
    viewOptions!: any;

    get properties() {
        const props = this.$utils.pageList.getAllowedDisplayProperties(
            this.pageListType,
            this.entityId,
        );
        return [
            ...props,
            ...this.customLabelTypes
        ]
    }

    get selected() {
        return this.viewOptions.selectedDisplayProperties ?? [];
    }

    get customLabelTypes() {
        return this.$utils.pageList.getCustomLabelTypes();
    }

    updateDisplayProperties(property: string) {
        let payload;
        if (this.selected.includes(property)) {
            payload = {
                selectedDisplayProperties: this.selected.filter(
                    (prop: string) => prop !== property,
                ),
            };
        } else {
            payload = {
                selectedDisplayProperties: [...this.selected, property],
            };
        }
        this.$emit('update', payload);
    }
}
</script>
<style lang="scss" scoped>
.page-display-properties {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    &__property {
        @include font12-500;
        padding: 5px 8px;
        color: var(--dropdown-controls-display-properties-text-color);
        background: var(--dropdown-controls-display-properties-bg-color);
        border-radius: 6px;

        &.selected {
            color: var(
                --dropdown-controls-display-properties-text-color__selected
            );
            background: var(
                --dropdown-controls-display-properties-bg-color__selected
            );

            &:hover {
                background: var(
                    --dropdown-controls-display-properties-bg-color__selected__hover
                );
            }
        }

        &:hover {
            color: var(
                --dropdown-controls-display-properties-text-color__selected
            );
            background: var(
                --dropdown-controls-display-properties-bg-color__selected
            );
        }
    }
}
</style>
