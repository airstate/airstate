export type TJSONAbleObject = {
    [key: string]: TJSONAble;
};

export type TJSONAble = string | number | boolean | null | TJSONAble[] | TJSONAbleObject;
