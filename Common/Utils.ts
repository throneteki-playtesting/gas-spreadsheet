export type SemanticVersion = `${number}.${number}.${number}`;

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Utils {
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
        Review: {
            id: {
                full: /^\w+@\d+@\d+.\d+.\d+$/
            }
        },
        SemanticVersion: /^\d+.\d+.\d+$/
    };

    export function titleCase(value: string) {
        return value.split(" ")
            .map(w => w[0].toUpperCase() + w.substring(1).toLowerCase())
            .join(" ");
    }

    export function cleanObject<T>(object: T) {
        for (const key in object) {
            if (object[key] === undefined) {
                delete object[key];
            }
        }

        return object;
    }

    export function distinct<T>(values: T[]) {
        return values.filter((value, index, array) => array.indexOf(value) === index);
    }
}

export {
    Utils
};