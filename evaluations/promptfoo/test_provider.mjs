import Provider, { callApi } from './provider.mjs';

async function test() {
  const p = new Provider();
  const result = await p.callApi('Retrieve guidelines about A2A mailboxes', {
    vars: { trust_zone: 'private_self', budget_bytes: 150000 }
  });
  console.log(result);
}
test();
