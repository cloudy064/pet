/// <reference types="miniprogram-api-typings" />
import { createWechatPet, createWechatComponent, WechatCanvas } from '../../engine';
import { PetCompanion, createWechatStore } from '../../engine/companion';
declare const canvas: WechatCanvas;
const pet = createWechatPet(canvas, wx, { size: 96, assetPack: 'https://cdn.example.com/pipi' });
Component(createWechatComponent(wx));
pet.pointerDown({ id: 1, x: 100, y: 100 });
pet.setVisible(false).setVisible(true);
const companion = new PetCompanion(pet, {
  storage: createWechatStore(wx),
  wallet: {
    async spend({ operationId }) {
      return { operationId, status: 'committed', revision: 1 };
    },
  },
});
companion.beginBath('bath-1');
companion.wash({ x: 0.5, y: 0.7 });
pet.destroy();
