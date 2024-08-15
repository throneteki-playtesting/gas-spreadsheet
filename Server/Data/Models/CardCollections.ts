// import Card from "./Card";

// export class CardNumberCollection /*implements Iterable<Card>*/ {
//     [number: number]: CardVersionCollection;
//     constructor(cards?: Card[]) {
//         for (const card of (cards || [])) {
//             this.add(card);
//         }
//     }

//     public add(card: Card) {
//         const number = card.development.number;
//         const version = card.development.versions.current.toString();

//         this[number] = this[number] || new CardVersionCollection();
//         this[number][version] = card;

//         return true;
//     }

//     public remove(card: Card) {
//         const number = card.development.number;
//         const version = card.development.versions.current.toString();

//         const vCollection = this[number];
//         if (vCollection && vCollection[version]) {
//             vCollection[version] = undefined;
//             return true;
//         }
//         return false;
//     }
// }

// class CardVersionCollection implements Iterable<Card> {
//     [version: string]: Card;
//     [Symbol.iterator](): Iterator<Card, any, undefined> {
//         return {
//             next: () => {

//                 if (index >= end) {
//                     return {
//                         value: null,
//                         done: true
//                     };
//                 } else {
//                     index++;
//                     return {
//                         value: index,
//                         done: index >= end
//                     };
//                 }
//             }
//         };
//     }

//     public latest() {
//         return;
//     }
// }