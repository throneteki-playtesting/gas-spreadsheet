export type ExpandoValue = string | number | ExpandoObject | ExpandoValue[];
export type SemanticVersion = `${number}.${number}.${number}`;

export interface ExpandoObject {
    [key: string]: ExpandoValue
}

export function getQuerySingle(value: string | string[]) {
    if (Array.isArray(value)) {
        return value[0].split(",")[0].trim();
    } else {
        return value.split(",")[0].trim();
    }
}

export function getQueryArray(value: string | string[]) {
    if (Array.isArray(value)) {
        return value.join(",").split(",").map((v) => v.trim());
    } else {
        return value.split(",").map((v) => v.trim());
    }
}

export function maxEnum(o: unknown) {
    return Math.max(...Object.keys(o).filter(obj => !isNaN(parseInt(obj))).map(obj => parseInt(obj))) + 1;
}

export const Regex = {
    Card: {
        id: {
            full: /^\d+@\d+.\d+.\d+$/,
            optional: /^\d+(?:@\d+.\d+.\d+)?$/
        }
    },
    SemanticVersion: /^\d+.\d+.\d+$/
};