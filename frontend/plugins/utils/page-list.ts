import { Context } from '@nuxt/types';
import { PageListType, SortingOptions } from '~/constants';
import ViewIcon from '~/components/view/ViewIcon.vue';
import ProjectIcon from '~/components/project/ProjectIcon.vue';
import InterfaceDashboardLayoutSquare from '~/components/streamline/InterfaceDashboardLayoutSquare.vue';
import { throttle } from '~/helpers';
import { IDocument } from '~/components/document/model';
import { IFolder } from '~/@types';
import { IView } from '~/components/view/model';
import { ViewPageOrderMultiplier } from '~/components/view/constants';
import ViewHeader from '~/components/view/ViewHeader.vue';
import ProjectHeader from '~/components/project/ProjectHeader.vue';

export class PageListUtils {
    private context: Context;

    constructor(ctx: Context) {
        this.context = ctx;
    }

    getPageListEntity(
        entityId: string,
        type: PageListType,
    ): IView | IFolder | null {
        if (type === PageListType.VIEW) {
            return this.context.$entities.view.getViewById(entityId);
        }
        if (type === PageListType.PROJECT) {
            return this.context.$entities.project.byId(entityId);
        }
        return null;
    }

    pageListHeader(type: PageListType) {
        if (type === PageListType.VIEW) {
            return ViewHeader;
        }
        if (type === PageListType.PROJECT) {
            return ProjectHeader;
        }
        return null;
    }

    getAllowedDisplayProperties(type: PageListType, id: string) {
        if (type === PageListType.VIEW) {
            const view = this.context.$entities.view.getViewById(id);
            if (!view) return [];
            return this.context.$entities.view.getDisplayPropertiesForViewType(
                view.type,
            );
        }
        if (type === PageListType.PROJECT) {
            return this.context.$entities.project.projectDisplayProperties;
        }
        return [];
    }

    getPageListViewOptions(type: PageListType, id: string) {
        if (type === PageListType.VIEW) {
            return this.context.$entities.view.getViewOptions(id);
        }
        if (type === PageListType.PROJECT) {
            return this.context.$entities.project.getProjectViewOptions(id);
        }
        return {
            sortBy: SortingOptions.UPDATED_AT,
            sortDirection: 'desc',
            collapsed: {},
            showTasks: false,
            hideCompletedTasks: false,
            selectedDisplayProperties: [
                'icon',
                'tasks',
                'date',
                'breadcrumbs',
                'updated',
            ],
        };
    }

    updatePageListViewOptions(type: PageListType, id: string, options: any) {
        if (type === PageListType.VIEW) {
            return this.context.$entities.view.updateViewOptions(id, options);
        }
        if (type === PageListType.PROJECT) {
            return this.context.$entities.project.updateProjectViewOptions(
                id,
                options,
            );
        }
    }

    getCustomLabelTypes() {
        return this.context.store.getters['page-list/customLabelTypes'];
    }

    setCustomLabelTypes(customLabelTypes: string[]) {
        this.context.store.commit('page-list/setCustomLabelTypes', customLabelTypes);
    }

    getFilterOperation() {
        return this.context.store.getters['page-list/filterOperation'];
    }

    setFilterOperation(filterOperation: string) {
        this.context.store.commit('page-list/setFilterOperation', filterOperation);
    }

    getDragData() {
        return this.context.store.getters['page-list/dragData'];
    }

    startDrag(entityId: string, data: any) {
        window.$nuxt.$emit('view:dragPosition', {
            left: data.pageX,
            top: data.pageY,
        });
        this.context.store.commit('page-list/setDrag', {
            entityId,
            data,
        });
        const throttledByFps = throttle(requestAnimationFrame);
        const windowHeight = window.innerHeight;
        const cubicBezier = (
            t: number,
            initial: number,
            p1: number,
            p2: number,
            final: number,
        ) => {
            return (
                (1 - t) * (1 - t) * (1 - t) * initial +
                3 * (1 - t) * (1 - t) * t * p1 +
                3 * (1 - t) * t * t * p2 +
                t * t * t * final
            );
        };

        const onMouseMoveHandler = (event: MouseEvent) => {
            const scrollAreaSize = 100;
            const topArea = 20 + scrollAreaSize;
            throttledByFps(() => {
                let value = 0;
                if (event.pageY < topArea) {
                    value = Math.max(event.pageY - topArea);
                } else if (windowHeight - event.pageY < scrollAreaSize) {
                    value =
                        scrollAreaSize - Math.max(windowHeight - event.pageY);
                }
                if (value === 0) {
                    window.$nuxt.$emit('view:drag:scrollEnd', 0);
                } else {
                    const sign = Math.sign(value);
                    const bezierValue = cubicBezier(
                        Math.abs(value) / scrollAreaSize,
                        0,
                        1,
                        1,
                        1,
                    );
                    const scrollValue =
                        bezierValue < 1.001
                            ? Math.pow(bezierValue, 3)
                            : bezierValue;
                    window.$nuxt.$emit(
                        'view:drag:scrollStart',
                        scrollValue * sign * 10,
                    );
                }

                window.$nuxt.$emit('view:dragPosition', {
                    left: event.pageX,
                    top: event.pageY,
                });
            });
        };

        const onMouseUpHandler = (_: MouseEvent) => {
            setTimeout(() => {
                this.context.store.commit('page-list/clearDrag');
            }, 5);
            document.removeEventListener('mouseup', onMouseUpHandler);
            document.removeEventListener('mousemove', onMouseMoveHandler);
        };

        document.addEventListener('mousemove', onMouseMoveHandler);
        document.addEventListener('mouseup', onMouseUpHandler);
    }

    calculateOrder(before: number, after: number): number {
        const variation = 0.2;
        const base = 0.5 - variation / 2;
        const rangeModifier = base + Math.random() * variation;
        return before + rangeModifier * (after - before);
    }

    resolveCustomOrder(
        page: Partial<IDocument>,
        entityId: string,
        pageListType: PageListType,
    ) {
        let entity;
        if (pageListType === PageListType.VIEW) {
            entity = this.context.$entities.view.getViewById(entityId);
        }
        if (pageListType === PageListType.PROJECT) {
            entity = this.context.$entities.project.byId(entityId);
        }
        if (!entity) return null;
        if (!page.viewOrder?.[entity.id]) return null;
        return {
            id: page.id,
            order: page.viewOrder[entity.id],
        };
    }

    sortPagesByOrder(
        pages: any[],
        entityId: string,
        pageListType: PageListType,
    ) {
        const defaultOrderArray = [];
        const customOrderArray = [];
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const customOrder = this.resolveCustomOrder(
                page,
                entityId,
                pageListType,
            );
            if (customOrder) {
                customOrderArray.push({
                    ...customOrder,
                    index: i,
                });
                continue;
            }
            const pageOrder: number =
                defaultOrderArray.length * ViewPageOrderMultiplier;

            defaultOrderArray.push({
                id: page.id,
                order: pageOrder,
                index: i,
            });
        }
        const orderArray = [defaultOrderArray, customOrderArray].flat();
        return orderArray.sort((a, b) => {
            if (a.order < b.order) return -1;
            if (a.order > b.order) return 1;
            return 0;
        });
    }
}
