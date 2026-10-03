import { execFile } from 'node:child_process'

/** Runs a command, optionally writing `input` to its stdin; resolves with stdout. */
export function execCommand(command, args, { cwd, input, env } = {}) {
    return new Promise((resolve, reject) => {
        const child = execFile(command, args, { cwd, env: env ? { ...process.env, ...env } : process.env, maxBuffer: 20 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    // Never echo stdin: it may be a secret
                    reject(new Error(`${command} ${args.join(' ')} failed: ${String(stderr || error.message).trim()}`))
                } else {
                    resolve(stdout)
                }
            })
        if (input !== undefined) child.stdin.end(input)
    })
}

function parseJson(text, what) {
    try {
        return JSON.parse(text)
    } catch {
        throw new Error(`Unexpected output from railway ${what}: ${text.slice(0, 200)}`)
    }
}

/**
 * Railway CLI wrapper. Every command runs in `cwd`, a temporary directory linked to the client's project, so the
 * repository directory is never linked to any project. Variable values go through stdin, never on the command line.
 */
export function railwayCli({ cwd, exec = execCommand }) {
    const run = (args, options) => exec('railway', args, { cwd, ...options })
    const json = async (args, what = args[0]) => parseJson(await run([...args, '--json']), what)

    return {
        whoami: () => run(['whoami']),
        /** All projects of the account: [{ id, name, ... }]. */
        projects: async () => {
            const result = await json(['list'])
            return Array.isArray(result) ? result : result.projects || []
        },
        createProject: (name, workspace) => run(['init', '--name', name, ...(workspace ? ['--workspace', workspace] : []), '--json']),
        link: (projectId, environment = 'production') => run(['link', '--project', projectId, '--environment', environment, '--json']),
        /** Services of the linked environment: [{ id, name, source }]. */
        services: async () => {
            const result = await json(['service', 'list'])
            return Array.isArray(result) ? result : result.services || []
        },
        addMysql: () => run(['add', '--database', 'mysql', '--json']),
        addApp: (name, repo, branch) => run(['add', '--service', name, '--repo', repo, '--branch', branch, '--json']),
        connectSource: (service, repo, branch) => run(['service', 'source', 'connect', '--repo', repo, '--branch', branch, '--service', service]),
        /** Raw configuration of the linked environment (services by id, with `source` and `deploy`). */
        environmentConfig: () => json(['environment', 'config'], 'environment config'),
        /** Resolved variables of a service, as an object. Kept in memory only. */
        variables: async service => {
            const result = await json(['variable', 'list', '--service', service], 'variable list')
            return Array.isArray(result) ? Object.fromEntries(result.map(v => [v.name, v.value])) : result
        },
        setVariable: (service, key, value) =>
            run(['variable', 'set', key, '--stdin', '--service', service, '--skip-deploys'], { input: value }),
        /** Id of an environment of the linked project, by name. */
        environmentId: async name => {
            const status = await json(['status'])
            const found = (status.environments?.edges || []).map(e => e.node).find(e => e.name === name)
            if (!found) throw new Error(`Environment ${name} not found in project ${status.name}`)
            return found.id
        },
        // Through the GraphQL API: `environment edit --service-config <svc> deploy.sleepApplication false` answers
        // "No changes to apply" (CLI 5.62) and leaves App Sleeping on
        sleepEnabled: async (serviceId, environmentId) => parseJson(await run(['api',
            'query($s: String!, $e: String!) { serviceInstance(serviceId: $s, environmentId: $e) { sleepApplication } }',
            '--raw-var', `s=${serviceId}`, '--raw-var', `e=${environmentId}`, '--compact']), 'api').data.serviceInstance.sleepApplication !== false,
        disableSleep: (serviceId, environmentId) => run(['api',
            'mutation($s: String!, $e: String!) { serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: { sleepApplication: false }) }',
            '--raw-var', `s=${serviceId}`, '--raw-var', `e=${environmentId}`]),
        redeploy: service => run(['service', 'redeploy', '--service', service, '--yes']),
        domains: async service => (await json(['domain', 'list', '--service', service], 'domain list')).domains || [],
        addDomain: (service, domain, port) => json(['domain', domain, '--service', service, '--port', String(port)], 'domain'),
        domainStatus: (service, domain) => json(['domain', 'status', domain, '--service', service], 'domain status'),
    }
}
