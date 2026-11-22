'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldInput,
  FormField,
} from '@/components/admin-ui';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set the user must type exactly this text to enable confirm. */
  requireText?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);
  const [typed, setTyped] = useState('');

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setPending({ opts, resolve });
      }),
    []
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
    setTyped('');
  };

  const canConfirm = !pending?.opts.requireText || typed === pending.opts.requireText;
  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.opts.title}</DialogTitle>
            <DialogDescription className="text-start leading-relaxed">
              {pending?.opts.message}
            </DialogDescription>
          </DialogHeader>
          {pending?.opts.requireText ? (
            <FormField
              label={
                `برای تأیید عبارت ${pending.opts.requireText} را تایپ کنید:`
              }
              htmlFor="confirm-text"
            >
              <FieldInput
                id="confirm-text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                dir="ltr"
                autoComplete="off"
              />
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              {pending?.opts.cancelLabel ?? 'انصراف'}
            </Button>
            <Button
              type="button"
              variant={pending?.opts.danger ? 'destructive' : 'primary'}
              disabled={!canConfirm}
              onClick={() => {
                if (canConfirm) close(true);
              }}
            >
              {pending?.opts.confirmLabel ?? 'تأیید'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
