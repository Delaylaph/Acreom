import { v4 } from 'uuid';
import {
    FolderType,
    GroupingOptions,
    SortingOptions,
    TabType,
    ViewType,
} from '~/constants';
import { FolderController } from '~/plugins/entities/folder';
import { IProject } from '~/@types';
import { TrackingAction, TrackingType } from '~/@types/tracking';

export class ProjectController extends FolderController {
    getProjects(): IProject[] {
        return this.context.store.getters['folder/byType'](FolderType.PROJECT);
    }

    byId(id: string): IProject | null {
        return (
            this.getProjects().find((project: IProject) => project.id === id) ||
            null
        );
    }

    isProject(id: string): boolean {
        return this.byId(id) ? true : false;
    }

    getSidebarCount(id: string) {
        return this.context.store.getters['folder/projectPages'](id).length;
    }

    getProjectPages(id: string) {
        return this.context.store.getters['folder/projectPages'](id);
    }

    getProjectColor(id: string) {
        return this.byId(id)?.icon ? null : '#626F83';
    }

    async newProject() {
        const id = v4();
        const order = this.context.$utils.sidebar.getNewSidebarOrder();
        await this.context.store.dispatch('folder/update', {
            id,
            name: 'New Project',
            status: 'new',
            icon: null,
            type: FolderType.PROJECT,
            properties: {
                type: FolderType.PROJECT,
                order,
            },
        });
        return id;
    }

    get projectDisplayProperties() {
        return [
            'status',
            'icon',
            'tasks',
            'clip',
            'links',
            'date',
            'updated',
            'created',
        ];
    }

    getProjectViewOptions(id: string) {
        return (
            this.byId(id)?.properties.viewOptions ?? {
                sortBy: SortingOptions.MANUAL,
                groupBy: GroupingOptions.PAGE_STATUS,
                sortDirection: 'desc',
                collapsed: {},
                showTasks: false,
                hideCompletedTasks: false,
                selectedDisplayProperties: ['icon', 'tasks', 'date', 'updated'],
            }
        );
    }

    updateProjectViewOptions(id: string, value: any) {
        const project = this.byId(id);
        if (!project) {
            return;
        }
        const mergedProperties = {
            ...project.properties,
            viewOptions: value,
        };
        this.update({
            id,
            properties: mergedProperties,
        });
    }

    async archiveProject(id: string) {
        if (!id) return;
        const project = this.byId(id);
        if (!project) return;
        const folders = this.byParentId(id);
        const pages = this.context.$entities.page.byFolderId(id);

        if (!folders.length && !pages.length) {
            await this.archive(id);
            const activeTab = this.context.$tabs.activeTab();
            if (activeTab?.entityId === id) {
                const allPagesView = this.context.$entities.view.getViewByType(
                    ViewType.ALL_PAGES,
                );
                const tab = this.context.$tabs.createNewTabObject(
                    allPagesView.id,
                    TabType.VIEW,
                );
                await this.context.$tabs.openTab(tab);
            }
            await this.context.$tabs.closeTabsByEntityId(id);
            this.context.$tracking.trackEventV2(TrackingType.PROJECT, {
                action: TrackingAction.ARCHIVE,
                entityId: id,
            });
            return;
        }

        return this.context.$vfm.show({
            component: () =>
                import('@/components/modal/ProjectArchiveModal.vue'),
            bind: {
                id,
                type: FolderType.PROJECT,
            },
        });
    }

    async deleteProject(id: string) {
        if (!id) return;
        const project = this.byId(id);
        if (!project) return;
        const folders = this.byParentId(id);
        const pages = this.context.$entities.page.byFolderId(id);

        if (!folders.length && !pages.length) {
            await this.delete(id);
            await this.context.$tabs.closeTabsByEntityId(id);
            this.context.$tracking.trackEventV2(TrackingType.PROJECT, {
                action: TrackingAction.DELETE,
                entityId: id,
            });
            return;
        }

        return this.context.$vfm.show({
            component: () =>
                import('@/components/modal/ProjectDeleteModal.vue'),
            bind: {
                id,
                type: FolderType.PROJECT,
            },
        });
    }
}
