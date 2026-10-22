import { validateRecipe } from '../packages/core/dist/index.js';

const sampleFromPlan = {
  "slug": "trung-chien-ca-chua",
  "name": "Trứng chiên cà chua",
  "servings_base": 2,
  "difficulty": 1,
  "equipment": ["chao", "to", "dao-thot"],
  "ingredients": [
    { "ingredient": "trung-ga", "qty": 3, "unit": "quả", "role": "structure" },
    { "ingredient": "ca-chua", "qty": 2, "unit": "quả", "role": "flavor", "flavor_group": "acid" },
    { "ingredient": "hanh-la", "qty": 1, "unit": "nhánh", "role": "flavor", "optional": true },
    { "ingredient": "nuoc-mam", "qty": 1, "unit": "thìa cà phê", "role": "flavor", "flavor_group": "salt" },
    { "ingredient": "duong", "qty": 0.5, "unit": "thìa cà phê", "role": "flavor", "flavor_group": "sugar" },
    { "ingredient": "dau-an", "qty": 2, "unit": "thìa canh", "role": "moisture" }
  ],
  "steps": [
    { "id": "s1", "title": "Cắt cà chua", "kind": "active", "seconds": 120, "after": [], "resources": ["dao-thot"], "text": "Rửa và cắt cà chua thành múi cau." },
    { "id": "s2", "title": "Đánh trứng", "kind": "active", "seconds": 90, "after": [], "resources": ["to"], "text": "Đập trứng vào tô, thêm nước mắm, đánh đều." },
    { "id": "s3", "title": "Chiên trứng", "kind": "active", "seconds": 180, "after": ["s2"], "resources": ["chao"], "cue": "Mặt dưới vàng nhẹ thì lật", "text": "Cho dầu vào chảo, đổ trứng, chiên chín rồi múc ra đĩa." },
    { "id": "s4", "title": "Xào cà chua", "kind": "active", "seconds": 240, "after": ["s1", "s3"], "resources": ["chao"], "cue": "Cà chua mềm và ra nước", "text": "Xào cà chua với đường đến khi mềm." },
    { "id": "s5", "title": "Trộn và nêm", "kind": "active", "seconds": 60, "after": ["s4"], "resources": ["chao"], "text": "Cho trứng vào, đảo nhẹ, nêm nếm rồi rắc hành." }
  ]
};

console.log("=== CHẠY VALIDATOR VỚI JSON MẪU docs/plan.md NGUYÊN VĂN ===");
const result = validateRecipe(sampleFromPlan);
console.log("Result success:", result.success);
if (result.success) {
  console.log("DỮ LIỆU ĐÃ PARSE THÀNH CÔNG:");
  console.log(JSON.stringify(result.data, null, 2));
} else {
  console.log("LỖI VALIDATION:");
  console.log(JSON.stringify(result.errors, null, 2));
}
