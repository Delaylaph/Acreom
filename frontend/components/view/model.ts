import {
    GroupingOptions,
    SortingOptions,
    SourceOptions,
    ViewType,
} from '~/constants';
import { IDocument } from '~/components/document/model';
import { ITask } from '~/components/task/model';
import { IEvent } from '~/@types';

export type ViewPropertyDefinition = {
    id?: string;
    name?: string;
    property: keyof IDocument | keyof ITask | keyof IEvent;
    operation:
        | 'eq'
        | 'neq'
        | 'in'
        | 'notin'
        | 'gt'
        | 'lt'
        | 'gte'
        | 'lte'
        | 'isNotSet'
        | 'isSet'
        | 'overlap'
        | 'notoverlap';
    value: any;
};

export type ViewCombineDefinition = {
    combine: 'or' | 'and';
    definition: (ViewPropertyDefinition | ViewCombineDefinition)[];
};

export type ViewDefinition = ViewCombineDefinition[];

export interface IView {
    id: string;
    isDefault: boolean;
    isEditable?: boolean;
    order: number;
    type: ViewType;
    name: string;
    icon?: string;
    color?: string;
    emoji?: string;
    display?: boolean;
    definition: ViewDefinition;
    viewOptions: {
        sortBy: SortingOptions;
        groupBy?: GroupingOptions;
        sortDirection: 'desc' | 'asc';
        collapsed: Record<string, string>;
        selectedDisplayProperties: string[];
        showTasks: boolean;
        hideCompletedTasks: boolean;
    };
    editing?: boolean;
}
