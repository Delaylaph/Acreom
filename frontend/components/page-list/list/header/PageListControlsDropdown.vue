<template>
    <div class="page-list-controls-dropdown">
        <ViewFilterControls
            v-if="showFilterOptions"
            :pages="pages"
            :tab-id="tabId"
            :entity-id="entityId"
            :definitions="temporaryDefinitions"
            @update="updateFilters"
        />
        <hr v-if="showFilterOptions && showDisplayOptions" />
        <ViewDisplayControls
            v-if="showDisplayOptions"
            :show-group-options="showGroupOptions"
            :tab-id="tabId"
            :entity-id="entityId"
            @update="updateDisplayOptions"
        />
    </div>
</template>
<script lang="ts">
import { Component, Prop, Provide, Vue } from 'vue-property-decorator';
import ViewFilterControls from '~/components/view/controls/display/ViewFilterControls.vue';
import ViewDisplayControls from '~/components/view/controls/filter/ViewDisplayControls.vue';
import { ViewPropertyDefinition } from '~/components/view/model';
import { PageListType } from '~/constants';
import { PageListSymbols } from '~/constants/symbols';

@Component({
    name: 'PageListControlsDropdown',
    components: {
        ViewDisplayControls,
        ViewFilterControls,
    },
})
export default class PageListControlsDropdown extends Vue {
    @Prop({})
    tabId!: string;

    @Prop()
    pages!: [];

    @Prop({})
    entityId!: string;

    @Prop({ default: true })
    showFilterOptions!: boolean;

    @Prop({ default: true })
    showDisplayOptions!: boolean;

    @Prop({ default: true })
    showGroupOptions!: boolean;

    @Prop({})
    definitions!: ViewPropertyDefinition[];

    @Prop({ required: true })
    @Provide(PageListSymbols.TYPE)
    pageListType!: PageListType;

    temporaryDefinitions: ViewPropertyDefinition[] = [];

    updateFilters(data: any) {
        this.temporaryDefinitions = data;
        this.$emit('update-filters', data);
    }

    updateDisplayOptions(data: any) {
        this.$emit('update-display-options', data);
    }

    mounted() {
        this.temporaryDefinitions = this.definitions;
    }
}
</script>
<style lang="scss" scoped>
.page-list-controls-dropdown {
    @include frostedGlassBackground;
    padding: 12px;
    border-radius: 12px;
    user-select: none;
    width: 270px;

    hr {
        margin: 10px 0 10px;
        border-color: var(--context-menu-divider-color);
    }
}
</style>
