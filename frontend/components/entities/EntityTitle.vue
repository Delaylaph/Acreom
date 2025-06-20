<template>
    <div class="entity-title">
        <component
            :is="titleComponent"
            @focus-tab="$emit('focus-tab')"
            @paste:multiline="$emit('paste:multiline', $event)"
        />
    </div>
</template>
<script lang="ts">
import { Vue, Component, Inject, InjectReactive } from 'vue-property-decorator';
import { TabSymbols } from '~/constants/symbols';

@Component({
    name: 'EntityTitle',
    components: {},
})
export default class EntityTitle extends Vue {
    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    @InjectReactive(TabSymbols.ENTITY_TYPE)
    entityType!: string;

    get titleComponent() {
        return this.$componentsRepository.getTitle(this.entityType, this.tabId);
    }
}
</script>
<style lang="scss">
.entity-title {
    flex: 1;
    padding: 0 30px 0 20px;
}
</style>
