import type { Character } from '../common/typings';
import targets from '../../data/targets.json';
import locations from '../../data/locations.json';
import atms from '../../data/atms.json';
import { hideTextUI } from '@overextended/ox_lib/client';
import { SendTypedNUIMessage, serverNuiCallback } from 'utils';
import { getLocales, locale } from '@overextended/ox_lib/shared';
import { OxAccountPermissions, OxAccountRole } from '@overextended/ox_core';

const usingTarget = GetConvarInt('ox_banking:target', 0) === 1;
let hasLoadedUi = false;
let isUiOpen = false;
let isATMopen = false;

function initUI() {
  if (hasLoadedUi) return;

  const accountRoles: OxAccountRole[] = GlobalState.accountRoles;

  // @ts-expect-error
  const permissions: Record<OxAccountRoles, OxAccountPermissions> = {};

  accountRoles.forEach((role) => {
    permissions[role] = GlobalState[`accountRole.${role}`] as OxAccountPermissions;
  });

  SendNUIMessage({
    action: 'setInitData',
    data: {
      locales: getLocales(),
      permissions,
    },
  });

  hasLoadedUi = true;
}

const openATM = () => {
  initUI();

  isUiOpen = true;
  isATMopen = true;

  SendTypedNUIMessage('openATM', null);
  SetNuiFocus(true, true);
};

exports('openATM', openATM);

const openBank = () => {
  initUI();

  const playerCash: number = exports.ox_inventory.GetItemCount('money');
  isUiOpen = true;

  hideTextUI();

  SendTypedNUIMessage<Character>('openBank', { cash: playerCash });
  SetNuiFocus(true, true);
};

exports('openBank', openBank);

const createBankBlip = (coords: number[]) => {
  return
  const blip = AddBlipForCoord(coords[0], coords[1], coords[2]);
  SetBlipSprite(blip, 207);
  SetBlipColour(blip, 2);
  SetBlipAsShortRange(blip, true);
  BeginTextCommandSetBlipName('STRING');
  AddTextComponentString(locale('bank'));
  EndTextCommandSetBlipName(blip);
};

if (!usingTarget) {
  for (let i = 0; i < locations.length; i++) createBankBlip(locations[i]);
}

if (usingTarget) {
  exports.ox_target.addModel(
    atms.map((value) => GetHashKey(value)),
    {
      name: 'access_atm',
      icon: 'fa-solid fa-money-check',
      label: locale('target_access_atm'),
      onSelect: () => {
        openATM();
      },
    }
  );

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    exports.ox_target.addBoxZone({
      coords: target.coords,
      size: target.size,
      rotation: target.rotation,
      interactionDistance: 1.3,
      options: [
        {
          name: 'access_bank',
          icon: 'fa-solid fa-dollar-sign',
          label: locale('target_access_bank'),
          onSelect: () => {
            openBank();
          },
        },
      ],
    });

    createBankBlip(target.coords);
  }
}

RegisterNuiCallback('exit', (_: any, cb: Function) => {
  isUiOpen = false;
  isATMopen = false;

  SetNuiFocus(false, false);

  cb(1);
});

on('ox_inventory:itemCount', (itemName: string, count: number) => {
  if (!isUiOpen || isATMopen || itemName !== 'money') return;

  SendTypedNUIMessage<Character>('refreshCharacter', { cash: count });
});

serverNuiCallback('getDashboardData');
serverNuiCallback('transferOwnership');
serverNuiCallback('manageUser');
serverNuiCallback('removeUser');
serverNuiCallback('getAccountUsers');
serverNuiCallback('addUserToAccount');
serverNuiCallback('getAccounts');
serverNuiCallback('createAccount');
serverNuiCallback('deleteAccount');
serverNuiCallback('depositMoney');
serverNuiCallback('withdrawMoney');
serverNuiCallback('transferMoney');
serverNuiCallback('renameAccount');
serverNuiCallback('convertAccountToShared');
serverNuiCallback('getLogs');
serverNuiCallback('getInvoices');
serverNuiCallback('payInvoice');
