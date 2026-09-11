/// <reference types="miniprogram-api-typings" />
import { createWechatPet, createWechatComponent, WechatCanvas } from '../../engine';
declare const canvas: WechatCanvas;
const pet = createWechatPet(canvas, wx, { size: 96 });
Component(createWechatComponent(wx));
pet.pointerDown({ id: 1, x: 100, y: 100 });
pet.setVisible(false).setVisible(true);
pet.destroy();
