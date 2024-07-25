export type ExpandoValue = string | number | ExpandoObject | ExpandoValue[];

export interface ExpandoObject {
    [key: string]: ExpandoValue
}