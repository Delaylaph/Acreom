<template>
    <div class="page-list-source view-filter-controls__item">
        Filter operation
        <div class="page-list-source__dropdown">
            <ASelect
                :items="filterOperations"
                :value="operationValue"
                :width="150"
                :dropdown-width="150"
                check-placement="start"
                @change="changeFilterOperation"
            />
        </div>
    </div>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import ASelect from '~/components/ASelect.vue';

@Component({
    name: 'FilterOperation',
    components: {
        ASelect,
    },
})
export default class FilterOperation extends Vue {

    get currentOperation() {
        return this.$utils.pageList.getFilterOperation();
    }

    get filterOperations() {
        return [
            {
                id: 'overlap',
                label: 'Overlap',
            },
            {
                id: 'containsAll',
                label: 'Contains all',
            },
        ];
    }

    get operationValue() {
        return this.currentOperation === 'overlap'
            ? 'overlap'
            : 'containsAll';
    }

    changeFilterOperation(value: string) {
        this.$utils.pageList.setFilterOperation(value);
    }
}
</script>
<style lang="scss" scoped>
.page-list-source {
    @include font12-500;
    outline: none;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--dropdown-controls-text-color);

    button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--dropdown-controls-select-bg-color);
        border-radius: 6px;
        outline: none;
        color: var(--dropdown-controls-select-text);
        z-index: 11;

        &:hover,
        &.active {
            background: var(--dropdown-controls-select-bg-color__hover);
            color: var(--dropdown-controls-select-text-color__hover);
        }
    }

    &__dropdown {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;

        &--order {
            padding: 7px;
        }
    }
}
</style>
