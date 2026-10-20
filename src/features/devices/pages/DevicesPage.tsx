import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  Confirmation,
  Input,
  OperationalPage,
  PrimaryButton,
  WhiteButton,
} from "@solaria.network/web-lib";
import { firebaseConfigured } from "../../../lib/firebase";
import { validateDevice, type QaDevice } from "../devices.model";
import {
  removeDevice,
  saveDevice,
  signInWithGoogle,
  signOutFromFirebase,
  watchDevices,
  watchFirebaseUser,
} from "../devices.service";

function messageOf(failure: unknown): string {
  if (
    failure instanceof Error &&
    /permission|insufficient/i.test(failure.message)
  ) {
    return "Sem permissão. A conta Google precisa estar cadastrada em qa_admins no Firestore.";
  }
  return failure instanceof Error ? failure.message : "Erro inesperado.";
}

export default function DevicesPage() {
  if (!firebaseConfigured) {
    return (
      <OperationalPage
        title="Firebase não configurado"
        description="Defina as variáveis VITE_FIREBASE_* para gerenciar os dispositivos QA."
        centered
        sideBackground
      />
    );
  }
  return <DevicesManager />;
}

function DevicesManager() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [devices, setDevices] = useState<QaDevice[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [pending, setPending] = useState<{
    title: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(
    () =>
      watchFirebaseUser((next) => {
        setDevices([]);
        setUser(next);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    return watchDevices(setDevices, (failure) => setError(messageOf(failure)));
  }, [user]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const fid = String(data.get("fid") ?? "");
    const label = String(data.get("label") ?? "");
    const authorized = data.get("authorized") === "on";
    const invalid = validateDevice({ fid, label });
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending({
      title: "Salvar este dispositivo no QA?",
      action: async () => {
        await saveDevice({ fid, label, authorized });
        form.reset();
      },
    });
  }

  if (user === undefined) {
    return (
      <p role="status" className="p-6">
        Carregando…
      </p>
    );
  }

  if (!user) {
    return (
      <section className="flex max-w-xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Dispositivos QA</h1>
        <p>
          Entre com uma conta Google cadastrada como administradora para
          autorizar os celulares que podem usar o app QA.
        </p>
        <PrimaryButton
          type="button"
          content="Entrar com Google"
          description="Entrar com Google para gerenciar dispositivos"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
        />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dispositivos QA</h1>
          <p className="text-sm">Conectado como {user.email}</p>
        </div>
        <WhiteButton
          type="button"
          content="Sair do Google"
          description="Sair da conta Google"
          disabled={busy}
          onClick={() => void run(signOutFromFirebase)}
        />
      </header>

      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-medium border p-4"
      >
        <label className="flex flex-col gap-2">
          FID da instalação
          <Input
            name="fid"
            placeholder="22 caracteres, copiados da tela Diagnóstico do app QA"
            required
            className="w-full"
          />
        </label>
        <label className="flex flex-col gap-2">
          Apelido
          <Input
            name="label"
            placeholder="Pixel do Davi"
            required
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="authorized" defaultChecked />
          Autorizado a usar o QA
        </label>
        <PrimaryButton
          type="submit"
          content="Salvar dispositivo"
          description="Salvar dispositivo"
          disabled={busy}
        />
      </form>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label="Dispositivos cadastrados">
        {devices.length === 0 && <li>Nenhum dispositivo cadastrado.</li>}
        {devices.map((device) => (
          <li
            key={device.fid}
            className="flex flex-wrap items-center justify-between gap-3 rounded-medium border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{device.label}</p>
              <p className="break-all text-xs">{device.fid}</p>
            </div>
            <div className="flex items-center gap-2">
              <span>{device.authorized ? "Autorizado" : "Bloqueado"}</span>
              <WhiteButton
                type="button"
                content={device.authorized ? "Bloquear" : "Autorizar"}
                description={`${device.authorized ? "Bloquear" : "Autorizar"} ${device.label}`}
                disabled={busy}
                onClick={() =>
                  setPending({
                    title: device.authorized
                      ? "Bloquear este dispositivo?"
                      : "Autorizar este dispositivo?",
                    action: () =>
                      saveDevice({
                        fid: device.fid,
                        label: device.label,
                        authorized: !device.authorized,
                      }),
                  })
                }
              />
              <WhiteButton
                type="button"
                content="Remover"
                description={`Remover ${device.label}`}
                disabled={busy}
                onClick={() =>
                  setPending({
                    title: "Remover este dispositivo?",
                    action: () => removeDevice(device.fid),
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
      {pending && (
        <Confirmation
          title={pending.title}
          message="Esta operação altera o acesso ao ambiente de QA."
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            void run(pending.action).then(() => setPending(null));
          }}
        />
      )}
    </section>
  );
}
