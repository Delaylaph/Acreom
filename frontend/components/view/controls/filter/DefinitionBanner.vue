<template>
    <div
        class="definition-banner"
        :class="{ selectable: isSelectableOperation }"
    >
        <div v-if="isSelectableOperation" class="definition-banner__definition">
            <div class="definition-banner__definition--text">
                {{ definitionName }}
            </div>
            <div class="definition-banner__definition--text">
                {{ readableOperation }}
            </div>
            <ASelect
                :items="items"
                :value="temporarySelectedItems"
                :multi="isMultiselect"
                :show-arrow="false"
                :search="true"
                :width="134"
                :clear="true"
                check-placement="end"
                :search-placeholder="searchPlaceholder"
                :placeholder="placeholder"
                @change="update"
                @close="$emit('close', temporarySelectedItems)"
            />
        </div>
        <div v-else class="definition-banner__definition">
            <div class="definition-banner__definition--text">
                {{ readableOperation }}
            </div>
            <div class="definition-banner__definition--text">
                {{ definitionName }}
            </div>
        </div>
        <div class="definition-banner--reset">
            <button @click="remove">
                <XIcon size="16" class="icon" />
            </button>
        </div>
    </div>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch, Inject } from 'vue-property-decorator';
import { XIcon } from '@vue-hero-icons/solid';
import { ViewPropertyDefinition } from '~/components/view/model';
import ASelect from '~/components/ASelect.vue';
import { TrackingAction, TrackingActionSource } from '~/@types/tracking';
import { TabSymbols } from '~/constants/symbols';

@Component({
    name: 'DefinitionBanner',
    components: { XIcon, ASelect },
})
export default class DefinitionBanner extends Vue {
    @Prop({ required: true })
    definition!: ViewPropertyDefinition;

    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    temporarySelectedItems: any = this.isMultiselect ? [] : null;

    get isSelectableOperation() {
        return !['has', 'isSet', 'isNotSet'].includes(
            this.definition.operation,
        );
    }

    get isMultiselect() {
        return ['in', 'overlap', 'nooverlap', 'containsAll'].includes(this.definition.operation);
    }

    get items() {
        const items = this.propertyDefinition!.items;
        const tempSelected: string[] | null = Array.isArray(
            this.temporarySelectedItems,
        )
            ? this.temporarySelectedItems
            : null;

        if (!tempSelected) return items;

        return items;
    }

    get propertyDefinition() {
        return this.$entities.view.propertyViewDefinition(
            this.definition.property,
        );
    }

    get readableOperation() {
        return this.$entities.view.readableOperation(this.definition.operation);
    }

    get definitionName() {
        return this.definition!.name;
    }

    get searchPlaceholder() {
        return `Search ` + this.propertyDefinition!.placeholderSuffix;
    }

    get placeholder() {
        return `Filter ` + this.propertyDefinition!.placeholderSuffix;
    }

    update(value: any[]) {
        this.temporarySelectedItems = value;
        this.$emit('update', {
            ...this.definition,
            value,
        });
    }

    remove() {
        this.$emit('delete');
    }

    @Watch('definition.value', { immediate: true })
    handleValueChange() {
        this.temporarySelectedItems = this.definition.value;
    }
}
</script>
<style scoped lang="scss">
.definition-banner {
    background: var(--banner-definition-filter-bg-color);
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    border-radius: 6px;
    gap: 7px;

    &.selectable {
        padding: 4px 10px;
    }

    &__definition {
        display: flex;
        align-items: center;
        gap: 4px;

        &--text {
            @include font12-500;
            color: var(--banner-definition-filter-text-color);
        }

        :deep {
            .filter {
                display: grid;
                grid-template-columns: max-content min-content;
                gap: 8px;
            }

            .a-select {
                &__button {
                    padding: 2px 4px;
                }
            }
        }
    }

    &--reset {
        line-height: 10px;

        &:hover {
            color: var(--banner-definition-filter-text-color__hover);
        }
    }
}
</style>
