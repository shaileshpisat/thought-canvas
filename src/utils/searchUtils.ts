import { CanvasItem } from '../types/canvas';

export interface SubCanvasInfo {
    id: string;
    name: string;
    path: string[];
    parentName?: string;
}

export const getAllSubCanvases = (
    items: CanvasItem[],
    basePath: string[] = [],
    parentName?: string
): SubCanvasInfo[] => {
    const canvases: SubCanvasInfo[] = [];
    for (const item of items) {
        if (item.type === 'canvas') {
            canvases.push({ 
                id: item.id, 
                name: item.content, 
                path: [...basePath, item.id],
                parentName
            });
            if (item.children) {
                canvases.push(...getAllSubCanvases(item.children, [...basePath, item.id], item.content));
            }
        }
    }
    return canvases;
};
