'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Bot, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import type { RobotAccount } from '@agent-spaces/shared';

interface WechatQRState {
  status: 'idle' | 'loading' | 'wait' | 'scaned' | 'confirmed' | 'expired';
  qrcodeImgContent?: string;
  sessionId?: string;
}

function buildQRImageUrl(content: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(content)}`;
}

export function RobotAccountsTab() {
  const t = useTranslations('robotAccounts');
  const tc = useTranslations('common');
  const [accounts, setAccounts] = useState<RobotAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RobotAccount | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // lark form state
  const [formName, setFormName] = useState('');
  const [formLarkAppId, setFormLarkAppId] = useState('');
  const [formLarkAppSecret, setFormLarkAppSecret] = useState('');
  const [saving, setSaving] = useState(false);

  // wechat QR state
  const [wechatQR, setWechatQR] = useState<WechatQRState>({ status: 'idle' });
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const pollingRef = useRef(false);

  const fetchAccounts = () => {
    fetch('/api/robot-accounts')
      .then((r) => r.json())
      .then((data) => { setAccounts(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openAddLark = () => {
    setEditing(null);
    setFormName('');
    setFormLarkAppId('');
    setFormLarkAppSecret('');
    setDialogOpen(true);
  };

  const openEdit = (account: RobotAccount) => {
    setEditing(account);
    setFormName(account.name);
    setFormLarkAppId(account.lark?.appId ?? '');
    setFormLarkAppSecret(account.lark?.appSecret ?? '');
    setDialogOpen(true);
  };

  const handleSaveLark = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: formName, type: 'lark', lark: { appId: formLarkAppId, appSecret: formLarkAppSecret } };
      const res = editing
        ? await fetch(`/api/robot-accounts/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/robot-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed');
      }
      toast.success(editing ? t('updateSuccess') : t('createSuccess'));
      setDialogOpen(false);
      fetchAccounts();
    } catch (err) {
      toast.error(editing ? t('updateFailed') : t('createFailed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  // WeChat QR flow
  const handleLoadWechatQR = async () => {
    if (wechatQR.status === 'loading') return;
    setWechatQR({ status: 'loading' });
    try {
      const res = await fetch('/api/robot-accounts/wechat/qr', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setWechatQR({ status: 'wait', qrcodeImgContent: data.qrcodeImgContent, sessionId: data.sessionId });
    } catch (err) {
      toast.error(t('createFailed'), { description: err instanceof Error ? err.message : undefined });
      setWechatQR({ status: 'idle' });
    }
  };

  // poll wechat QR
  useEffect(() => {
    if (!wechatDialogOpen || !['wait', 'scaned'].includes(wechatQR.status) || !wechatQR.sessionId) return;
    const timer = window.setInterval(() => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      fetch('/api/robot-accounts/wechat/qr/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: wechatQR.sessionId }),
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data?.error || 'Poll failed');
          setWechatQR((prev) => ({ ...prev, status: data.status }));
          if (data.status === 'confirmed' && data.account) {
            toast.success(t('createSuccess'));
            setWechatDialogOpen(false);
            setWechatQR({ status: 'idle' });
            fetchAccounts();
          }
          if (data.status === 'expired') {
            toast.error(t('wechatExpired'));
          }
        })
        .catch(() => {})
        .finally(() => { pollingRef.current = false; });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [wechatDialogOpen, wechatQR.status, wechatQR.sessionId, t]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/robot-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('deleteSuccess'));
      setDeleting(null);
      fetchAccounts();
    } catch {
      toast.error(t('deleteFailed'));
    }
  };

  const larkAccounts = accounts.filter((a) => a.type === 'lark');
  const wechatAccounts = accounts.filter((a) => a.type === 'wechat');

  const larkValid = formName.trim() && formLarkAppId.trim() && formLarkAppSecret.trim();

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t('title')}
        </label>
        <p className="text-xs text-muted-foreground mb-4">{t('description')}</p>
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={openAddLark}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('addLark')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setWechatDialogOpen(true); setWechatQR({ status: 'idle' }); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('addWechat')}
        </Button>
      </div>

      {loading ? null : accounts.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <Bot className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">{t('noAccounts')}</p>
          <p className="text-xs text-muted-foreground">{t('noAccountsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {larkAccounts.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">{t('lark')}</h5>
              {larkAccounts.map((a) => (
                <AccountCard key={a.id} account={a} onEdit={openEdit} onDelete={setDeleting} />
              ))}
            </div>
          )}
          {wechatAccounts.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">{t('wechat')}</h5>
              {wechatAccounts.map((a) => (
                <AccountCard key={a.id} account={a} onEdit={() => {}} onDelete={setDeleting} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Lark Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('editAccount') : t('addLark')}</DialogTitle>
            <DialogDescription>{t('lark')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">{t('name')}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">{t('larkFields.appId')}</Label>
              <Input value={formLarkAppId} onChange={(e) => setFormLarkAppId(e.target.value)} placeholder="cli_xxx" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">{t('larkFields.appSecret')}</Label>
              <Input type="password" value={formLarkAppSecret} onChange={(e) => setFormLarkAppSecret(e.target.value)} placeholder="app secret" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
            <Button type="button" size="sm" onClick={handleSaveLark} disabled={!larkValid || saving}>{t('save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WeChat QR Dialog */}
      <Dialog open={wechatDialogOpen} onOpenChange={setWechatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('addWechat')}</DialogTitle>
            <DialogDescription>{t('wechatQrDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {wechatQR.status === 'idle' && (
              <div className="flex justify-center py-4">
                <Button type="button" onClick={handleLoadWechatQR}>
                  <QrCode className="mr-1.5 h-4 w-4" />
                  {t('getQr')}
                </Button>
              </div>
            )}

            {wechatQR.status === 'loading' && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {['wait', 'scaned', 'expired'].includes(wechatQR.status) && wechatQR.qrcodeImgContent && (
              <>
                <div className="flex items-center gap-3 rounded-md border border-dashed px-3 py-3">
                  <img
                    src={buildQRImageUrl(wechatQR.qrcodeImgContent)}
                    alt="WeChat QR code"
                    className="h-36 w-36 shrink-0 rounded border bg-white p-2"
                  />
                  <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      {wechatQR.status === 'wait' && t('wechatWaitScan')}
                      {wechatQR.status === 'scaned' && <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {t('wechatScanned')}</>}
                      {wechatQR.status === 'expired' && t('wechatExpired')}
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button type="button" size="sm" variant="outline" onClick={handleLoadWechatQR}>
                    <Loader2 className={wechatQR.status === 'loading' ? 'mr-1.5 h-3.5 w-3.5 animate-spin' : 'hidden'} />
                    {t('refreshQr')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteAccount')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDeleting(null)}>{tc('cancel')}</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => deleting && handleDelete(deleting)}>{t('deleteAccount')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCard({ account, onEdit, onDelete }: { account: RobotAccount; onEdit: (a: RobotAccount) => void; onDelete: (id: string) => void }) {
  const t = useTranslations('robotAccounts');
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{account.name}</div>
        <div className="text-xs text-muted-foreground">
          {account.type === 'lark'
            ? `${t('lark')} · ${account.lark?.appId ?? '-'}`
            : `${t('wechat')} · ${account.wechat?.accountId ?? '-'}`}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {account.type === 'lark' && (
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(account)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(account.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
