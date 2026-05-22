import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('about'.tr(), style: const TextStyle(fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        children: [
          const SizedBox(height: 32),
          Icon(Icons.hub_outlined, size: 64, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Center(
            child: Text(
              'app_name'.tr(),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Center(
            child: Text(
              'v0.1.0',
              style: TextStyle(
                fontSize: 13,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              'about_description_text'.tr(),
              style: TextStyle(
                fontSize: 13,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 24),
          _SectionHeader(title: 'about_project'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.info_outline, size: 20),
            title: Text('about_project_name'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'Agent Spaces',
              style: TextStyle(fontSize: 11),
            ),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.description_outlined, size: 20),
            title: Text('about_description'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'Multi-Agent Collaborative Programming Platform',
              style: TextStyle(fontSize: 11),
            ),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.tag, size: 20),
            title: Text('about_version'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              '0.1.0 (Build 1)',
              style: TextStyle(fontSize: 11),
            ),
          ),
          _SectionHeader(title: 'about_links'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.code, size: 20),
            title: const Text('GitHub', style: TextStyle(fontSize: 13)),
            subtitle: const Text(
              'github.com/hunmer/agent-spaces',
              style: TextStyle(fontSize: 11),
            ),
            onTap: () => launchUrl(Uri.parse('https://github.com/hunmer/agent-spaces')),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.bug_report_outlined, size: 20),
            title: Text('about_submit_issue'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'github.com/hunmer/agent-spaces/issues',
              style: TextStyle(fontSize: 11),
            ),
            onTap: () => launchUrl(Uri.parse('https://github.com/hunmer/agent-spaces/issues')),
          ),
          _SectionHeader(title: 'about_tech_stack'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.phone_android, size: 20),
            title: Text('about_mobile'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'Flutter + Riverpod + InAppWebView',
              style: TextStyle(fontSize: 11),
            ),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.web, size: 20),
            title: Text('about_web'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'Next.js 16 + TailwindCSS + shadcn/ui',
              style: TextStyle(fontSize: 11),
            ),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.dns_outlined, size: 20),
            title: Text('about_server'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: const Text(
              'Express 5 + WebSocket + SQLite',
              style: TextStyle(fontSize: 11),
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'about_copyright'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
