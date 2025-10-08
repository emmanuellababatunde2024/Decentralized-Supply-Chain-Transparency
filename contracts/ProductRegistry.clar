(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PRODUCT-ID u101)
(define-constant ERR-INVALID-NAME u102)
(define-constant ERR-INVALID-ORIGIN u103)
(define-constant ERR-INVALID-DOCUMENT-HASH u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-PRODUCT-ALREADY-EXISTS u106)
(define-constant ERR-PRODUCT-NOT-FOUND u107)
(define-constant ERR-INVALID-MANUFACTURER u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-BATCH-NUMBER u110)
(define-constant ERR-INVALID-EXPIRY-DATE u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-PRODUCTS-EXCEEDED u114)
(define-constant ERR-INVALID-PRODUCT-TYPE u115)
(define-constant ERR-INVALID-QUANTITY u116)
(define-constant ERR-INVALID-PRICE u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var next-product-id uint u0)
(define-data-var max-products uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map products
  uint
  {
    product-id: (string-ascii 64),
    name: (string-ascii 100),
    origin: (string-ascii 100),
    document-hash: (string-ascii 64),
    timestamp: uint,
    manufacturer: principal,
    product-type: (string-ascii 50),
    batch-number: (string-ascii 50),
    expiry-date: uint,
    location: (string-ascii 100),
    currency: (string-ascii 20),
    status: bool,
    quantity: uint,
    price: uint
  }
)

(define-map products-by-id
  (string-ascii 64)
  uint)

(define-map product-updates
  uint
  {
    update-name: (string-ascii 100),
    update-origin: (string-ascii 100),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-product (id uint))
  (map-get? products id)
)

(define-read-only (get-product-updates (id uint))
  (map-get? product-updates id)
)

(define-read-only (is-product-registered (product-id (string-ascii 64)))
  (is-some (map-get? products-by-id product-id))
)

(define-private (validate-product-id (id (string-ascii 64)))
  (if (and (> (len id) u0) (<= (len id) u64))
      (ok true)
      (err ERR-INVALID-PRODUCT-ID))
)

(define-private (validate-name (name (string-ascii 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-NAME))
)

(define-private (validate-origin (origin (string-ascii 100)))
  (if (and (> (len origin) u0) (<= (len origin) u100))
      (ok true)
      (err ERR-INVALID-ORIGIN))
)

(define-private (validate-document-hash (hash (string-ascii 64)))
  (if (is-eq (len hash) u64)
      (ok true)
      (err ERR-INVALID-DOCUMENT-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-product-type (type (string-ascii 50)))
  (if (and (> (len type) u0) (<= (len type) u50))
      (ok true)
      (err ERR-INVALID-PRODUCT-TYPE))
)

(define-private (validate-batch-number (batch (string-ascii 50)))
  (if (and (> (len batch) u0) (<= (len batch) u50))
      (ok true)
      (err ERR-INVALID-BATCH-NUMBER))
)

(define-private (validate-expiry-date (expiry uint))
  (if (> expiry block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY-DATE))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-quantity (qty uint))
  (if (> qty u0)
      (ok true)
      (err ERR-INVALID-QUANTITY))
)

(define-private (validate-price (price uint))
  (if (>= price u0)
      (ok true)
      (err ERR-INVALID-PRICE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-products (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-PRODUCTS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-products new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-product
  (product-id (string-ascii 64))
  (name (string-ascii 100))
  (origin (string-ascii 100))
  (document-hash (string-ascii 64))
  (product-type (string-ascii 50))
  (batch-number (string-ascii 50))
  (expiry-date uint)
  (location (string-ascii 100))
  (currency (string-ascii 20))
  (quantity uint)
  (price uint)
)
  (let (
        (next-id (var-get next-product-id))
        (current-max (var-get max-products))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PRODUCTS-EXCEEDED))
    (try! (validate-product-id product-id))
    (try! (validate-name name))
    (try! (validate-origin origin))
    (try! (validate-document-hash document-hash))
    (try! (validate-product-type product-type))
    (try! (validate-batch-number batch-number))
    (try! (validate-expiry-date expiry-date))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-quantity quantity))
    (try! (validate-price price))
    (asserts! (is-none (map-get? products-by-id product-id)) (err ERR-PRODUCT-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set products next-id
      {
        product-id: product-id,
        name: name,
        origin: origin,
        document-hash: document-hash,
        timestamp: block-height,
        manufacturer: tx-sender,
        product-type: product-type,
        batch-number: batch-number,
        expiry-date: expiry-date,
        location: location,
        currency: currency,
        status: true,
        quantity: quantity,
        price: price
      }
    )
    (map-set products-by-id product-id next-id)
    (var-set next-product-id (+ next-id u1))
    (print { event: "product-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-product
  (id uint)
  (update-name (string-ascii 100))
  (update-origin (string-ascii 100))
)
  (let ((product (map-get? products id)))
    (match product
      p
        (begin
          (asserts! (is-eq (get manufacturer p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-name update-name))
          (try! (validate-origin update-origin))
          (map-set products id
            {
              product-id: (get product-id p),
              name: update-name,
              origin: update-origin,
              document-hash: (get document-hash p),
              timestamp: block-height,
              manufacturer: (get manufacturer p),
              product-type: (get product-type p),
              batch-number: (get batch-number p),
              expiry-date: (get expiry-date p),
              location: (get location p),
              currency: (get currency p),
              status: (get status p),
              quantity: (get quantity p),
              price: (get price p)
            }
          )
          (map-set product-updates id
            {
              update-name: update-name,
              update-origin: update-origin,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "product-updated", id: id })
          (ok true)
        )
      (err ERR-PRODUCT-NOT-FOUND)
    )
  )
)

(define-public (get-product-count)
  (ok (var-get next-product-id))
)

(define-public (check-product-existence (product-id (string-ascii 64)))
  (ok (is-product-registered product-id))
)