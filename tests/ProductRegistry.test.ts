import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PRODUCT_ID = 101;
const ERR_INVALID_NAME = 102;
const ERR_INVALID_ORIGIN = 103;
const ERR_INVALID_DOCUMENT_HASH = 104;
const ERR_INVALID_PRODUCT_TYPE = 115;
const ERR_INVALID_BATCH_NUMBER = 110;
const ERR_INVALID_EXPIRY_DATE = 111;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_QUANTITY = 116;
const ERR_INVALID_PRICE = 117;
const ERR_MAX_PRODUCTS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_PRODUCT_ALREADY_EXISTS = 106;
const ERR_PRODUCT_NOT_FOUND = 107;

interface Product {
  productId: string;
  name: string;
  origin: string;
  documentHash: string;
  timestamp: number;
  manufacturer: string;
  productType: string;
  batchNumber: string;
  expiryDate: number;
  location: string;
  currency: string;
  status: boolean;
  quantity: number;
  price: number;
}

interface ProductUpdate {
  updateName: string;
  updateOrigin: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProductRegistryMock {
  state: {
    nextProductId: number;
    maxProducts: number;
    registrationFee: number;
    authorityContract: string | null;
    products: Map<number, Product>;
    productUpdates: Map<number, ProductUpdate>;
    productsById: Map<string, number>;
  } = {
    nextProductId: 0,
    maxProducts: 10000,
    registrationFee: 500,
    authorityContract: null,
    products: new Map(),
    productUpdates: new Map(),
    productsById: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProductId: 0,
      maxProducts: 10000,
      registrationFee: 500,
      authorityContract: null,
      products: new Map(),
      productUpdates: new Map(),
      productsById: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerProduct(
    productId: string,
    name: string,
    origin: string,
    documentHash: string,
    productType: string,
    batchNumber: string,
    expiryDate: number,
    location: string,
    currency: string,
    quantity: number,
    price: number
  ): Result<number> {
    if (this.state.nextProductId >= this.state.maxProducts) return { ok: false, value: ERR_MAX_PRODUCTS_EXCEEDED };
    if (!productId || productId.length > 64) return { ok: false, value: ERR_INVALID_PRODUCT_ID };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_NAME };
    if (!origin || origin.length > 100) return { ok: false, value: ERR_INVALID_ORIGIN };
    if (documentHash.length !== 64) return { ok: false, value: ERR_INVALID_DOCUMENT_HASH };
    if (!productType || productType.length > 50) return { ok: false, value: ERR_INVALID_PRODUCT_TYPE };
    if (!batchNumber || batchNumber.length > 50) return { ok: false, value: ERR_INVALID_BATCH_NUMBER };
    if (expiryDate <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY_DATE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (quantity <= 0) return { ok: false, value: ERR_INVALID_QUANTITY };
    if (price < 0) return { ok: false, value: ERR_INVALID_PRICE };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.productsById.has(productId)) return { ok: false, value: ERR_PRODUCT_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextProductId;
    const product: Product = {
      productId,
      name,
      origin,
      documentHash,
      timestamp: this.blockHeight,
      manufacturer: this.caller,
      productType,
      batchNumber,
      expiryDate,
      location,
      currency,
      status: true,
      quantity,
      price,
    };
    this.state.products.set(id, product);
    this.state.productsById.set(productId, id);
    this.state.nextProductId++;
    return { ok: true, value: id };
  }

  getProduct(id: number): Product | null {
    return this.state.products.get(id) || null;
  }

  updateProduct(id: number, updateName: string, updateOrigin: string): Result<boolean> {
    const product = this.state.products.get(id);
    if (!product) return { ok: false, value: false };
    if (product.manufacturer !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (!updateOrigin || updateOrigin.length > 100) return { ok: false, value: false };

    const updated: Product = {
      ...product,
      name: updateName,
      origin: updateOrigin,
      timestamp: this.blockHeight,
    };
    this.state.products.set(id, updated);
    this.state.productUpdates.set(id, {
      updateName,
      updateOrigin,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getProductCount(): Result<number> {
    return { ok: true, value: this.state.nextProductId };
  }

  checkProductExistence(productId: string): Result<boolean> {
    return { ok: true, value: this.state.productsById.has(productId) };
  }
}

describe("ProductRegistry", () => {
  let contract: ProductRegistryMock;

  beforeEach(() => {
    contract = new ProductRegistryMock();
    contract.reset();
  });

  it("registers a product successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerProduct(
      "PROD001",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const product = contract.getProduct(0);
    expect(product?.productId).toBe("PROD001");
    expect(product?.name).toBe("Coffee Beans");
    expect(product?.origin).toBe("Ethiopia");
    expect(product?.productType).toBe("food");
    expect(product?.batchNumber).toBe("BATCH001");
    expect(product?.expiryDate).toBe(100000);
    expect(product?.location).toBe("Warehouse A");
    expect(product?.currency).toBe("STX");
    expect(product?.quantity).toBe(1000);
    expect(product?.price).toBe(50);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate product ids", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerProduct(
      "PROD001",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    const result = contract.registerProduct(
      "PROD001",
      "Tea Leaves",
      "India",
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "food",
      "BATCH002",
      200000,
      "Warehouse B",
      "USD",
      500,
      30
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PRODUCT_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.registerProduct(
      "PROD002",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects product registration without authority contract", () => {
    const result = contract.registerProduct(
      "PROD003",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid product id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerProduct(
      "",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRODUCT_ID);
  });

  it("rejects invalid name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerProduct(
      "PROD004",
      "",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("updates a product successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerProduct(
      "PROD005",
      "Old Name",
      "Old Origin",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    const result = contract.updateProduct(0, "New Name", "New Origin");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const product = contract.getProduct(0);
    expect(product?.name).toBe("New Name");
    expect(product?.origin).toBe("New Origin");
    const update = contract.state.productUpdates.get(0);
    expect(update?.updateName).toBe("New Name");
    expect(update?.updateOrigin).toBe("New Origin");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent product", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateProduct(99, "New Name", "New Origin");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerProduct(
      "PROD006",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateProduct(0, "New Name", "New Origin");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    contract.registerProduct(
      "PROD007",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct product count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerProduct(
      "PROD008",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    contract.registerProduct(
      "PROD009",
      "Tea Leaves",
      "India",
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "food",
      "BATCH002",
      200000,
      "Warehouse B",
      "USD",
      500,
      30
    );
    const result = contract.getProductCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks product existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerProduct(
      "PROD010",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    const result = contract.checkProductExistence("PROD010");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProductExistence("NONEXISTENT");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses product parameters with Clarity types", () => {
    const productId = stringAsciiCV("PROD011");
    const quantity = uintCV(1000);
    const price = uintCV(50);
    expect(productId.value).toBe("PROD011");
    expect(quantity.value).toEqual(BigInt(1000));
    expect(price.value).toEqual(BigInt(50));
  });

  it("rejects product registration with empty product id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerProduct(
      "",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRODUCT_ID);
  });

  it("rejects product registration with max products exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxProducts = 1;
    contract.registerProduct(
      "PROD012",
      "Coffee Beans",
      "Ethiopia",
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "food",
      "BATCH001",
      100000,
      "Warehouse A",
      "STX",
      1000,
      50
    );
    const result = contract.registerProduct(
      "PROD013",
      "Tea Leaves",
      "India",
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      "food",
      "BATCH002",
      200000,
      "Warehouse B",
      "USD",
      500,
      30
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PRODUCTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});