import provider from './provider.mjs';

async function test() {
  const result = await provider('Retrieve guidelines about A2A mailboxes', {
    vars: { trust_zone: 'private_self', budget_bytes: 150000 }
  });
  console.log(result);
}
test();
