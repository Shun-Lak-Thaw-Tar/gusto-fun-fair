import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api, API_BASE, ApiFailure, session, type Session } from "./api";
import "./styles.css";

type Runner = (work: () => Promise<any>) => Promise<any>;
const pretty = (value: any) => JSON.stringify(value, null, 2);
const idOf = (value: any) => String(value?._id || value?.id || "");

function ErrorBox({ error }: { error: ApiFailure | null }) {
  if (!error) return null;
  return (
    <details className="error" open>
      <summary>
        Request failed: {error.method} {error.url.replace(API_BASE, "")} (
        {error.status || "network"})
      </summary>
      <p>{error.message}</p>
      <pre>{pretty(error.payload)}</pre>
    </details>
  );
}
function Raw({ value }: { value: any }) {
  return value === undefined ? null : (
    <details className="raw">
      <summary>View Raw Response</summary>
      <pre>{pretty(value)}</pre>
    </details>
  );
}
function Loading({ text = "Loading..." }: { text?: string }) {
  return <span className="loading">{text}</span>;
}
function Button({ children, busy, ...props }: any) {
  return (
    <button disabled={busy || props.disabled} {...props}>
      {busy ? <Loading text="Working..." /> : children}
    </button>
  );
}
function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
function JsonTable({ data }: { data: any }) {
  if (!data || typeof data !== "object") return <pre>{String(data)}</pre>;
  return (
    <div className="json-grid">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <b>{key}</b>
          <span>
            {typeof value === "object" ? pretty(value) : String(value ?? "")}
          </span>
        </div>
      ))}
    </div>
  );
}

function Layout({
  current,
  onLogout,
  children,
}: {
  current: Session | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const role = current?.role || "GUEST";
  const links =
    role === "admin"
      ? [
          ["/admin", "Dashboard"],
          ["/admin/orders", "Orders"],
          ["/admin/payments", "Payments"],
          ["/admin/catalog", "Catalog"],
          ["/admin/tickets", "Tickets"],
          ["/admin/memories", "Memories"],
          ["/admin/letters", "Letters"],
          ["/admin/event", "Event"],
        ]
      : role === "stall_owner"
        ? [
            ["/owner", "Dashboard"],
            ["/owner/stall", "My Stall"],
            ["/owner/foods", "Foods"],
            ["/owner/sales", "Sales"],
            ["/owner/share", "Share"],
          ]
        : [
            ["/", "Home"],
            ["/catalog", "Catalog"],
            ["/orders", "Orders"],
            ["/tickets", "Tickets"],
            ["/memories", "Memories"],
            ["/letters", "Crush Letters"],
          ];
  return (
    <>
      <header>
        <Link className="brand" to="/">
          GUSTO <small>API TEST FRONTEND</small>
        </Link>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/developer">Developer</NavLink>
        </nav>
        <div className="session-chip">
          {role}
          {current ? (
            <button onClick={onLogout}>Log out</button>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer>
        API: {API_BASE} <span>Backend calls are real; no mock data.</span>
      </footer>
    </>
  );
}

function Home({
  current,
  run,
  last,
}: {
  current: Session | null;
  run: Runner;
  last: any;
}) {
  const [event, setEvent] = useState<any>();
  const [health, setHealth] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const load = async () => {
    try {
      setError(null);
      const [e, h] = await Promise.all([api.event(), api.health()]);
      setEvent(e.data.event);
      setHealth(h.data);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <div className="hero">
        <p className="eyebrow">Temporary browser client</p>
        <h1>Test the fair, one real request at a time.</h1>
        <p>
          Use this small frontend to exercise customer, admin, and Stall Owner
          APIs with visible status and raw responses.
        </p>
        <div className="actions">
          <Link className="button" to={current ? "/catalog" : "/login"}>
            {current ? "Browse catalog" : "Register or log in"}
          </Link>
          <Button onClick={load}>Test API connection</Button>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="columns">
        <Card title="Backend status">
          <JsonTable data={health || { status: "Not tested" }} />
        </Card>
        <Card title="Current event">
          <JsonTable data={event || { status: "Loading..." }} />
          <Raw value={last} />
        </Card>
      </div>
    </>
  );
}

function Auth({ onLogin }: { onLogin: (value: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [raw, setRaw] = useState<any>();
  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "login"
          ? await api.login({ name, password })
          : await api.register({ name, password });
      setRaw(result.data);
      onLogin({
        token: result.data.token,
        user: result.data.user,
        role: result.data.user.role,
      });
    } catch (e) {
      setError(e as ApiFailure);
      setRaw((e as ApiFailure).payload);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="narrow">
      <Card title={mode === "login" ? "Log in" : "Register"}>
        <form onSubmit={submit}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <Button type="submit" busy={busy}>
            {mode === "login" ? "Log in" : "Create user"}
          </Button>
        </form>
        <p className="muted">
          {mode === "login"
            ? "Need a normal customer account?"
            : "Already registered?"}{" "}
          <button
            className="link-button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
      </Card>
      <ErrorBox error={error} />
      <Raw value={raw} />
    </div>
  );
}

function Catalog({
  addToCart,
  run,
}: {
  addToCart: (item: any) => void;
  run: Runner;
}) {
  const [foods, setFoods] = useState<any[]>([]);
  const [stalls, setStalls] = useState<any[]>([]);
  const [stallId, setStallId] = useState("");
  const [foodId, setFoodId] = useState("");
  const [error, setError] = useState<ApiFailure | null>(null);
  const load = async () => {
    try {
      setError(null);
      const [s, f] = await Promise.all([
        api.stalls(),
        api.foods(
          `?${stallId ? `stallId=${stallId}&` : ""}${foodId ? `foodId=${foodId}` : ""}`,
        ),
      ]);
      setStalls(s.data.stalls || []);
      setFoods(f.data.foods || []);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Customer</p>
          <h1>Catalog</h1>
        </div>
        <Link className="button" to="/cart">
          Cart
        </Link>
      </div>
      <Card title="Filters">
        <div className="inline-form">
          <select value={stallId} onChange={(e) => setStallId(e.target.value)}>
            <option value="">All stalls</option>
            {stalls.map((s) => (
              <option key={idOf(s)} value={idOf(s)}>
                {s.stallName}
              </option>
            ))}
          </select>
          <input
            placeholder="Food ID (optional)"
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
          />
          <Button onClick={load}>Refresh</Button>
        </div>
      </Card>
      <ErrorBox error={error} />
      <div className="grid">
        {foods.map((item) => (
          <Card
            key={idOf(item)}
            title={item.food?.name || item.foodName || item.name}
          >
            <p>
              {item.food?.description || item.description || "No description"}
            </p>
            <p>
              <b>{item.stallName || item.stallId?.stallName}</b>
            </p>
            <div className="price">
              {item.preorderPrice} <small>from {item.eventDayPrice}</small>
            </div>
            <p>
              Discount: {pretty(item.discount)}
              <br />
              Remaining: {item.ticketsRemaining ?? "n/a"}
            </p>
            <Button onClick={() => addToCart(item)}>Add to cart</Button>
            <Raw value={item} />
          </Card>
        ))}
      </div>
      {!foods.length && (
        <Card>
          <p>No foods returned. Seed or create catalog data first.</p>
        </Card>
      )}
    </>
  );
}

function Cart({
  cart,
  setCart,
  current,
  run,
}: {
  cart: any[];
  setCart: (x: any[]) => void;
  current: Session;
  run: Runner;
}) {
  const [raw, setRaw] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const total = cart.reduce(
    (sum, x) => sum + (x.preorderPrice || 0) * x.quantity,
    0,
  );
  const create = async () => {
    setBusy(true);
    try {
      const result = await api.createOrder(
        {
          items: cart.map((x) => ({
            stallFoodId: idOf(x),
            quantity: x.quantity,
          })),
        },
        current.token,
      );
      setRaw(result.data);
      setCart([]);
    } catch (e) {
      setError(e as ApiFailure);
      setRaw((e as ApiFailure).payload);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-head">
        <h1>Cart</h1>
        <Link className="button" to="/catalog">
          Back to catalog
        </Link>
      </div>
      <ErrorBox error={error} />
      {cart.map((item) => (
        <div className="cart-row" key={idOf(item)}>
          <span>{item.food?.name || item.name}</span>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) =>
              setCart(
                cart.map((x) =>
                  x === item ? { ...x, quantity: Number(e.target.value) } : x,
                ),
              )
            }
          />
          <b>{(item.preorderPrice || 0) * item.quantity}</b>
          <Button onClick={() => setCart(cart.filter((x) => x !== item))}>
            Remove
          </Button>
        </div>
      ))}
      <Card title="Client estimate (server is authoritative)">
        <p>{total}</p>
        <Button disabled={!cart.length} busy={busy} onClick={create}>
          Place order
        </Button>
      </Card>
      <Raw value={raw} />
    </>
  );
}

function Orders({
  current,
  initialOrderId,
}: {
  current: Session;
  initialOrderId?: string;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const [raw, setRaw] = useState<any>();
  const [busy, setBusy] = useState("");
  const load = async () => {
    try {
      const result = await api.orders(current.token);
      setOrders(result.data.orders || []);
      if (initialOrderId) select(initialOrderId);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  const select = async (id: string) => {
    try {
      const result = await api.order(id, current.token);
      setSelected(result.data.order);
      setRaw(result.data);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const action = async (name: string, work: () => Promise<any>) => {
    if (name === "cancel" && !confirm("Cancel this order?")) return;
    setBusy(name);
    try {
      const result = await work();
      setRaw(result.data);
      await load();
      if (selected) await select(idOf(selected));
    } catch (e) {
      setError(e as ApiFailure);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <div className="page-head">
        <h1>My Orders</h1>
        <Button onClick={load}>Refresh</Button>
      </div>
      <ErrorBox error={error} />
      <div className="columns">
        <Card title="Orders">
          <div className="list">
            {orders.map((order) => (
              <button
                className="list-item"
                key={idOf(order)}
                onClick={() => select(idOf(order))}
              >
                <b>{order.paymentReference}</b>
                <span>
                  {order.status} / {order.inventoryStatus}
                </span>
                <span>{order.totalAmount}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Order details">
          {selected ? (
            <>
              <JsonTable data={selected} />
              <div className="actions">
                {selected.status === "AWAITING_PAYMENT" && (
                  <>
                    <Button
                      busy={busy === "declare"}
                      onClick={() =>
                        action("declare", () =>
                          api.declare(idOf(selected), current.token),
                        )
                      }
                    >
                      Declare KBZ payment
                    </Button>
                    <Button
                      busy={busy === "cancel"}
                      onClick={() =>
                        action("cancel", () =>
                          api.cancel(idOf(selected), current.token),
                        )
                      }
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {(selected.status === "PAYMENT_DECLARED" ||
                  selected.status === "PAYMENT_REUPLOAD_REQUESTED") && (
                  <PaymentUpload
                    order={selected}
                    current={current}
                    onDone={load}
                  />
                )}
              </div>
              <PaymentStatus order={selected} current={current} />
            </>
          ) : (
            <p>Select an order.</p>
          )}
          <Raw value={raw} />
        </Card>
      </div>
    </>
  );
}

function PaymentUpload({
  order,
  current,
  onDone,
}: {
  order: any;
  current: Session;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadPayment(idOf(order), file, current.token);
      onDone();
    } catch (e) {
      setError(e as ApiFailure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="upload">
      <label>
        Payment proof (JPEG, PNG, WebP)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <Button busy={busy} disabled={!file} onClick={upload}>
        {order.status === "PAYMENT_REUPLOAD_REQUESTED"
          ? "Upload new proof"
          : "Upload proof"}
      </Button>
      <ErrorBox error={error} />
    </div>
  );
}
function PaymentStatus({ order, current }: { order: any; current: Session }) {
  const [payment, setPayment] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  useEffect(() => {
    api
      .payment(idOf(order), current.token)
      .then((x) => setPayment(x.data.payment))
      .catch((e) => setError(e));
  }, [order]);
  return (
    <div className="subpanel">
      <h3>Payment</h3>
      <ErrorBox error={error} />
      {payment && (
        <>
          <JsonTable data={payment} />
          {payment.proofs?.map((proof: any) => (
            <Proof
              key={proof.version}
              paymentId={idOf(payment)}
              version={proof.version}
              token={current.token}
              label={`Proof ${proof.version}`}
            />
          ))}
        </>
      )}
    </div>
  );
}
function Proof({
  paymentId,
  version,
  token,
  label,
}: {
  paymentId: string;
  version: number;
  token: string;
  label: string;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let object = "";
    fetch(`${API_BASE}/payments/${paymentId}/proofs/${version}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        object = URL.createObjectURL(blob);
        setSrc(object);
      });
    return () => {
      if (object) URL.revokeObjectURL(object);
    };
  }, [paymentId, version, token]);
  return (
    <div>
      <p>{label}</p>
      {src && <img className="proof" src={src} alt={label} />}
    </div>
  );
}

function Tickets({ current }: { current: Session }) {
  const [items, setItems] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  useEffect(() => {
    api
      .tickets(current.token)
      .then((x) => setItems(x.data.tickets))
      .catch((e) => setError(e));
  }, []);
  return (
    <>
      <h1>My Tickets</h1>
      <ErrorBox error={error} />
      <div className="grid">
        {(items || []).map((ticket: any) => (
          <Card key={idOf(ticket)} title={ticket.code}>
            <div className="ticket-code">{ticket.code}</div>
            <JsonTable data={ticket} />
          </Card>
        ))}
      </div>
    </>
  );
}

function Memories({ current }: { current: Session | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const [raw, setRaw] = useState<any>();
  const load = async (before = "") => {
    try {
      const result = await api.memories(
        `?limit=20${before ? `&before=${before}` : ""}`,
      );
      setItems(
        before
          ? [...items, ...(result.data.memories || [])]
          : result.data.memories || [],
      );
      setCursor(result.data.nextCursor);
      setRaw(result.data);
      if (current)
        setAllowance((await api.allowance(current.token)).data.snaps);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, [current?.token]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Memories</h1>
          <p className="muted">
            Camera-first event snaps. The backend controls eligibility and
            quota.
          </p>
        </div>
        <Button onClick={() => load()}>Refresh</Button>
      </div>
      <ErrorBox error={error} />
      {current && (
        <>
          <Card title="Your allowance">
            <JsonTable data={allowance || { loading: true }} />
            <MemoryUpload current={current} onDone={() => load()} />
          </Card>
        </>
      )}
      <div className="gallery">
        {items.map((item) => (
          <MemoryCard
            key={idOf(item)}
            item={item}
            current={current}
            onChanged={() => load()}
          />
        ))}
      </div>
      {cursor && <Button onClick={() => load(cursor)}>Load more</Button>}
      <Raw value={raw} />
    </>
  );
}
function MemoryUpload({
  current,
  onDone,
}: {
  current: Session;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadMemory(file, caption, current.token);
      setCaption("");
      setFile(undefined);
      onDone();
    } catch (e) {
      setError(e as ApiFailure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="upload">
      <label>
        Take a new photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <input
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <Button busy={busy} disabled={!file} onClick={submit}>
        Upload memory
      </Button>
      <ErrorBox error={error} />
    </div>
  );
}
function MemoryCard({
  item,
  current,
  onChanged,
}: {
  item: any;
  current: Session | null;
  onChanged: () => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState<ApiFailure | null>(null);
  useEffect(() => {
    if (current)
      api
        .reaction(idOf(item), current.token)
        .then((x) => setReaction(x.data.reaction))
        .catch(() => {});
  }, [current?.token, idOf(item)]);
  const react = async (value: string | null) => {
    if (!current) return;
    try {
      const result = await api.setReaction(idOf(item), value, current.token);
      setReaction(result.data.reaction);
      onChanged();
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  const remove = async () => {
    if (!current || !confirm("Delete this memory?")) return;
    try {
      await api.deleteMemory(idOf(item), current.token);
      onChanged();
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  return (
    <Card>
      <img
        className="memory-image"
        src={`${API_BASE}${item.imageUrl}`}
        alt={item.caption || "Event memory"}
      />
      <p>
        <b>{item.accountName}</b> {item.caption}
      </p>
      <p>
        {item.likes || 0} likes · {item.dislikes || 0} dislikes
      </p>
      {current && (
        <div className="actions">
          <Button onClick={() => react(reaction === "LIKE" ? null : "LIKE")}>
            Like {reaction === "LIKE" ? "✓" : ""}
          </Button>
          <Button
            onClick={() => react(reaction === "DISLIKE" ? null : "DISLIKE")}
          >
            Dislike {reaction === "DISLIKE" ? "✓" : ""}
          </Button>
          <Button onClick={remove}>Delete own</Button>
        </div>
      )}
      <ErrorBox error={error} />
    </Card>
  );
}

function Letters({ current }: { current: Session | null }) {
  const [letters, setLetters] = useState<any[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ApiFailure | null>(null);
  const [raw, setRaw] = useState<any>();
  const load = () =>
    api
      .crushLetters()
      .then((x) => setLetters(x.data.crushLetters || []))
      .catch((e) => setError(e));
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: any) => {
    e.preventDefault();
    try {
      const result = await api.submitCrush({ recipientName, message });
      setRaw(result.data);
      setRecipientName("");
      setMessage("");
    } catch (e) {
      setError(e as ApiFailure);
      setRaw((e as ApiFailure).payload);
    }
  };
  return (
    <>
      <h1>Crush Letters</h1>
      <ErrorBox error={error} />
      <div className="columns">
        <Card title="Public approved letters">
          {letters.map((x) => (
            <article className="letter" key={idOf(x)}>
              <b>To: {x.recipientName}</b>
              <p>“{x.message}”</p>
              <small>Anonymous</small>
            </article>
          ))}
        </Card>
        {current && (
          <Card title="Submit anonymous letter">
            <form onSubmit={submit}>
              <label>
                Recipient
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </label>
              <label>
                Message
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  required
                />
              </label>
              <Button type="submit">Submit for review</Button>
            </form>
          </Card>
        )}
      </div>
      <Raw value={raw} />
    </>
  );
}

function Admin({
  current,
  section = "dashboard",
}: {
  current: Session | null;
  section?: string;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const [raw, setRaw] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<any>({});
  const load = async () => {
    if (!current) return;
    setError(null);
    try {
      let result: any;
      if (section === "dashboard")
        result = await api.admin.dashboard(current.token);
      else if (section === "payments")
        result = await api.admin.payments(current.token);
      else if (section === "orders")
        result = await api.admin.orders(
          form.status ? `?status=${form.status}` : "",
          current.token,
        );
      else if (section === "catalog") {
        const [s, f, sf] = await Promise.all([
          api.admin.stalls(current.token),
          api.admin.foods(current.token),
          api.admin.stallFoods("", current.token),
        ]);
        result = {
          data: {
            stalls: s.data.stalls,
            foods: f.data.foods,
            stallFoods: sf.data.stallFoods,
          },
        };
      } else if (section === "tickets")
        result = selectedId
          ? await api.admin.ticket(selectedId, current.token)
          : { data: {} };
      else if (section === "letters")
        result = await api.admin.adminLetters("", current.token);
      else if (section === "event")
        result = await api.admin.event(current.token);
      else if (section === "memories")
        result = await api.admin.adminWindow(current.token);
      else result = await api.admin.stats(section, current.token);
      setData(result.data);
      setRaw(result.data);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, [current?.token, section]);
  const act = async (work: () => Promise<any>) => {
    setBusy(true);
    try {
      const result = await work();
      setRaw(result.data);
      await load();
    } catch (e) {
      setError(e as ApiFailure);
    } finally {
      setBusy(false);
    }
  };
  if (!current)
    return (
      <Card title="Admin test page">
        <p>
          Log in with an admin account. You can also open this route without a
          token to see the backend authorization response.
        </p>
      </Card>
    );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin API</p>
          <h1>{section}</h1>
        </div>
        <Button onClick={load}>Refresh</Button>
      </div>
      <ErrorBox error={error} />
      <AdminControls
        section={section}
        form={form}
        setForm={setForm}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        onAction={act}
        busy={busy}
      />
      <Card title="Response">
        <JsonTable data={data} />
      </Card>
      <Raw value={raw} />
    </>
  );
}
function AdminControls({
  section,
  form,
  setForm,
  selectedId,
  setSelectedId,
  onAction,
  busy,
}: any) {
  if (section === "payments")
    return (
      <Card title="Payment review">
        <input
          placeholder="Payment ID"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        />
        <input
          type="number"
          placeholder="Proof version"
          value={form.proofVersion || ""}
          onChange={(e) =>
            setForm({ ...form, proofVersion: Number(e.target.value) })
          }
        />
        <input
          placeholder="Reason"
          value={form.reason || ""}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <div className="actions">
          <Button
            busy={busy}
            onClick={() =>
              onAction(() =>
                api.admin.reviewPayment(
                  selectedId,
                  { decision: "APPROVED", proofVersion: form.proofVersion },
                  session.read()!.token,
                ),
              )
            }
          >
            Approve
          </Button>
          <Button
            busy={busy}
            onClick={() =>
              onAction(() =>
                api.admin.reviewPayment(
                  selectedId,
                  {
                    decision: "REUPLOAD_REQUESTED",
                    proofVersion: form.proofVersion,
                    reason: form.reason,
                  },
                  session.read()!.token,
                ),
              )
            }
          >
            Request re-upload
          </Button>
          <Button
            busy={busy}
            onClick={() =>
              onAction(() =>
                api.admin.reviewPayment(
                  selectedId,
                  {
                    decision: "REJECTED",
                    proofVersion: form.proofVersion,
                    reason: form.reason,
                  },
                  session.read()!.token,
                ),
              )
            }
          >
            Reject
          </Button>
        </div>
      </Card>
    );
  if (section === "orders")
    return (
      <Card title="Filter">
        <input
          placeholder="Status, e.g. PAYMENT_SUBMITTED"
          value={form.status || ""}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        />
        <Button
          onClick={() =>
            onAction(async () =>
              api.admin.orders(
                form.status ? `?status=${form.status}` : "",
                session.read()!.token,
              ),
            )
          }
        >
          Apply filter
        </Button>
      </Card>
    );
  if (section === "tickets")
    return (
      <Card title="Ticket lookup">
        <input
          placeholder="Ticket code"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        />
        <div className="actions">
          <Button
            onClick={() =>
              onAction(() =>
                api.admin.ticket(selectedId, session.read()!.token),
              )
            }
          >
            Lookup
          </Button>
          <Button
            onClick={() => {
              if (confirm("Redeem this ticket?"))
                onAction(() =>
                  api.admin.redeem(selectedId, session.read()!.token),
                );
            }}
          >
            Redeem
          </Button>
        </div>
      </Card>
    );
  if (section === "catalog")
    return (
      <CatalogAdmin
        form={form}
        setForm={setForm}
        onAction={onAction}
        busy={busy}
      />
    );
  if (section === "event")
    return (
      <EventAdmin
        form={form}
        setForm={setForm}
        onAction={onAction}
        busy={busy}
      />
    );
  if (section === "memories")
    return (
      <MemoryAdmin
        form={form}
        setForm={setForm}
        onAction={onAction}
        busy={busy}
      />
    );
  if (section === "letters")
    return (
      <LetterAdmin
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        onAction={onAction}
        busy={busy}
      />
    );
  return null;
}
function CatalogAdmin({ form, setForm, onAction, busy }: any) {
  return (
    <Card title="Create catalog records">
      <div className="form-grid">
        <input
          placeholder="Stall name"
          value={form.stallName || ""}
          onChange={(e) => setForm({ ...form, stallName: e.target.value })}
        />
        <input
          placeholder="Batch"
          value={form.batch || ""}
          onChange={(e) => setForm({ ...form, batch: e.target.value })}
        />
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.createStall(
                { stallName: form.stallName, batch: form.batch },
                session.read()!.token,
              ),
            )
          }
        >
          Create stall
        </Button>
        <input
          placeholder="Food name"
          value={form.name || ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Category"
          value={form.category || ""}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.createFood(
                { name: form.name, category: form.category },
                session.read()!.token,
              ),
            )
          }
        >
          Create food
        </Button>
        <input
          placeholder="Stall ID"
          value={form.stallId || ""}
          onChange={(e) => setForm({ ...form, stallId: e.target.value })}
        />
        <input
          placeholder="Food ID"
          value={form.foodId || ""}
          onChange={(e) => setForm({ ...form, foodId: e.target.value })}
        />
        <input
          type="number"
          placeholder="Event-day price"
          value={form.eventDayPrice || ""}
          onChange={(e) =>
            setForm({ ...form, eventDayPrice: Number(e.target.value) })
          }
        />
        <input
          type="number"
          placeholder="Ticket limit"
          value={form.ticketLimit || ""}
          onChange={(e) =>
            setForm({ ...form, ticketLimit: Number(e.target.value) })
          }
        />
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.createStallFood(
                {
                  stallId: form.stallId,
                  foodId: form.foodId,
                  eventDayPrice: form.eventDayPrice,
                  discount: {
                    type: "percentage",
                    value: Number(form.discount || 0),
                  },
                  ticketLimit: form.ticketLimit,
                  isAvailable: true,
                },
                session.read()!.token,
              ),
            )
          }
        >
          Assign StallFood
        </Button>
      </div>
      <p className="muted">
        Use the response below for IDs. Protected calculated fields are never
        sent.
      </p>
    </Card>
  );
}
function EventAdmin({ form, setForm, onAction, busy }: any) {
  const update = (key: string, value: any) =>
    setForm({ ...form, [key]: value });
  return (
    <Card title="Partial event update">
      <div className="form-grid">
        <input
          placeholder="Event name"
          value={form.eventName || ""}
          onChange={(e) => update("eventName", e.target.value)}
        />
        <input
          type="datetime-local"
          value={form.eventDate || ""}
          onChange={(e) => update("eventDate", e.target.value)}
        />
        <input
          type="datetime-local"
          value={form.preorderOpenAt || ""}
          onChange={(e) => update("preorderOpenAt", e.target.value)}
        />
        <input
          type="datetime-local"
          value={form.preorderCloseAt || ""}
          onChange={(e) => update("preorderCloseAt", e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={form.orderingEnabled || false}
            onChange={(e) => update("orderingEnabled", e.target.checked)}
          />{" "}
          ordering enabled
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.memoriesEnabled || false}
            onChange={(e) => update("memoriesEnabled", e.target.checked)}
          />{" "}
          memories enabled
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.crushLettersEnabled || false}
            onChange={(e) => update("crushLettersEnabled", e.target.checked)}
          />{" "}
          Crush Letters enabled
        </label>
      </div>
      <Button
        busy={busy}
        onClick={() =>
          onAction(() =>
            api.admin.updateEvent(
              {
                ...form,
                featureFlags: {
                  ...(form.memoriesEnabled === undefined
                    ? {}
                    : { memoriesEnabled: form.memoriesEnabled }),
                  ...(form.crushLettersEnabled === undefined
                    ? {}
                    : { crushLettersEnabled: form.crushLettersEnabled }),
                },
              },
              session.read()!.token,
            ),
          )
        }
      >
        Save event settings
      </Button>
    </Card>
  );
}
function MemoryAdmin({ form, setForm, onAction, busy }: any) {
  return (
    <Card title="Memory upload window">
      <div className="form-grid">
        <input
          type="datetime-local"
          value={form.opensAt || ""}
          onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
        />
        <input
          type="datetime-local"
          value={form.closesAt || ""}
          onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
        />
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.updateWindow(
                {
                  opensAt: new Date(form.opensAt).toISOString(),
                  closesAt: new Date(form.closesAt).toISOString(),
                },
                session.read()!.token,
              ),
            )
          }
        >
          Save window
        </Button>
      </div>
    </Card>
  );
}
function LetterAdmin({ selectedId, setSelectedId, onAction, busy }: any) {
  return (
    <Card title="Moderate letter">
      <input
        placeholder="Letter ID"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      />
      <div className="actions">
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.reviewLetter(
                selectedId,
                { decision: "APPROVED" },
                session.read()!.token,
              ),
            )
          }
        >
          Approve
        </Button>
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.reviewLetter(
                selectedId,
                { decision: "REJECTED" },
                session.read()!.token,
              ),
            )
          }
        >
          Reject
        </Button>
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.visibilityLetter(
                selectedId,
                { hidden: true },
                session.read()!.token,
              ),
            )
          }
        >
          Hide
        </Button>
        <Button
          busy={busy}
          onClick={() =>
            onAction(() =>
              api.admin.visibilityLetter(
                selectedId,
                { hidden: false },
                session.read()!.token,
              ),
            )
          }
        >
          Restore
        </Button>
      </div>
    </Card>
  );
}

function Owner({
  current,
  section = "dashboard",
}: {
  current: Session | null;
  section?: string;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const load = async () => {
    try {
      if (!current) return;
      const result = await (
        {
          dashboard: api.owner.dashboard,
          stall: api.owner.stall,
          foods: api.owner.foods,
          sales: api.owner.sales,
          share: api.owner.share,
        } as any
      )[section](current.token);
      setData(result.data);
    } catch (e) {
      setError(e as ApiFailure);
    }
  };
  useEffect(() => {
    load();
  }, [current?.token, section]);
  return (
    <>
      <div className="page-head">
        <h1>Stall Owner: {section}</h1>
        <Button onClick={load}>Refresh</Button>
      </div>
      <ErrorBox error={error} />
      <Card title="Owner response">
        <JsonTable data={data} />
        <Raw value={data} />
      </Card>
    </>
  );
}

function Developer({
  current,
  onLogout,
}: {
  current: Session | null;
  onLogout: () => void;
}) {
  const [status, setStatus] = useState<any>();
  const [error, setError] = useState<ApiFailure | null>(null);
  const check = async () => {
    try {
      const result = await api.health();
      setStatus(result.data);
      setError(null);
    } catch (e) {
      setError(e as ApiFailure);
      setStatus({ status: "offline" });
    }
  };
  return (
    <>
      <h1>Developer panel</h1>
      <Card title="Session">
        <JsonTable
          data={{
            apiBase: API_BASE,
            role: current?.role || "GUEST",
            user: current?.user,
            token: current ? "Present" : "Absent",
          }}
        />
        <div className="actions">
          <Button onClick={check}>Test API connection</Button>
          <Button onClick={onLogout}>Clear session</Button>
        </div>
        <JsonTable data={status} />
      </Card>
      <ErrorBox error={error} />
      <Card title="Current debugging IDs">
        <p>
          IDs are shown in raw responses and can be copied from the browser.
        </p>
      </Card>
    </>
  );
}

function OrderRoute({
  current,
  onLogin,
}: {
  current: Session | null;
  onLogin: (value: Session) => void;
}) {
  const { id } = useParams();
  return current ? (
    <Orders current={current} initialOrderId={id} />
  ) : (
    <Auth onLogin={onLogin} />
  );
}

function AdminRoute({ current }: { current: Session | null }) {
  const { kind } = useParams();
  return <Admin current={current} section={kind || "overview"} />;
}

function OwnerRoute({ current }: { current: Session | null }) {
  const { section } = useParams();
  return <Owner current={current} section={section || "dashboard"} />;
}

function AppContent() {
  const [current, setCurrent] = useState<Session | null>(session.read());
  const [cart, setCart] = useState<any[]>([]);
  const [last, setLast] = useState<any>();
  const login = (value: Session) => {
    session.write(value);
    setCurrent(value);
  };
  const logout = () => {
    session.clear();
    setCurrent(null);
  };
  const run: Runner = async (work) => {
    const result = await work();
    setLast(result.data);
    return result;
  };
  const addToCart = (item: any) =>
    setCart((existing) => {
      const found = existing.find((x) => idOf(x) === idOf(item));
      return found
        ? existing.map((x) =>
            x === found ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [...existing, { ...item, quantity: 1 }];
    });
  return (
    <Layout current={current} onLogout={logout}>
      <Routes>
        <Route
          path="/"
          element={<Home current={current} run={run} last={last} />}
        />
        <Route path="/login" element={<Auth onLogin={login} />} />
        <Route
          path="/catalog"
          element={<Catalog addToCart={addToCart} run={run} />}
        />
        <Route
          path="/cart"
          element={
            current ? (
              <Cart cart={cart} setCart={setCart} current={current} run={run} />
            ) : (
              <Auth onLogin={login} />
            )
          }
        />
        <Route
          path="/orders"
          element={
            current ? <Orders current={current} /> : <Auth onLogin={login} />
          }
        />
        <Route
          path="/orders/:id"
          element={<OrderRoute current={current} onLogin={login} />}
        />
        <Route
          path="/tickets"
          element={
            current ? <Tickets current={current} /> : <Auth onLogin={login} />
          }
        />
        <Route path="/memories" element={<Memories current={current} />} />
        <Route path="/letters" element={<Letters current={current} />} />
        <Route path="/admin" element={<Admin current={current} />} />
        <Route
          path="/admin/orders"
          element={<Admin current={current} section="orders" />}
        />
        <Route
          path="/admin/payments"
          element={<Admin current={current} section="payments" />}
        />
        <Route
          path="/admin/catalog"
          element={<Admin current={current} section="catalog" />}
        />
        <Route
          path="/admin/tickets"
          element={<Admin current={current} section="tickets" />}
        />
        <Route
          path="/admin/memories"
          element={<Admin current={current} section="memories" />}
        />
        <Route
          path="/admin/letters"
          element={<Admin current={current} section="letters" />}
        />
        <Route
          path="/admin/event"
          element={<Admin current={current} section="event" />}
        />
        <Route
          path="/admin/statistics/:kind"
          element={<AdminRoute current={current} />}
        />
        <Route path="/owner" element={<Owner current={current} />} />
        <Route
          path="/owner/:section"
          element={<OwnerRoute current={current} />}
        />
        <Route
          path="/developer"
          element={<Developer current={current} onLogout={logout} />}
        />
        <Route
          path="*"
          element={
            <Card title="Not found">
              <Link to="/">Go home</Link>
            </Card>
          }
        />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
