import { useState } from 'react';

export default function HostNotificationsButton({ notifications }) {
  const [message, setMessage] = useState('');
  if (!notifications?.isHost) return null;
  const blocked = notifications.permission === 'denied';
  const unsupported = notifications.permission === 'unsupported';

  const handleClick = async () => {
    const result = await notifications.enable();
    setMessage(result.ok ? 'Alerts are active on this device.' : result.msg);
  };

  return (
    <div className="pull-slot host-notifications">
      <div className="pull-label">Host Notifications</div>
      <button className={notifications.enabled ? 'primary' : 'secondary'} style={{ width: '100%' }} disabled={notifications.enabled || unsupported} onClick={handleClick}>
        {notifications.enabled ? 'Host Notifications Enabled' : 'Enable Host Notifications'}
      </button>
      <div className="pull-extra">
        {message || (blocked
          ? 'Notifications are blocked in this browser. Enable them in your device settings first.'
          : 'Alerts for players joining, season and draft readiness, playoff opponents, and free agency offers.')}
      </div>
    </div>
  );
}
