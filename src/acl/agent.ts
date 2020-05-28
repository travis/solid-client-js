import {
  WebId,
  IriString,
  unstable_AclDataset,
  unstable_AccessModes,
  unstable_AclRule,
} from "../index";
import { getIriOne, getIriAll } from "../thing/get";
import { acl } from "../constants";
import {
  internal_getAclRules,
  internal_getResourceAclRulesForResource,
  internal_getDefaultAclRulesForResource,
  internal_getAccessModes,
  internal_combineAccessModes,
} from "../acl";

export type unstable_AgentAccess = Record<WebId, unstable_AccessModes>;

/**
 * Given an ACL LitDataset, find out which access modes it provides to an Agent for a given Resource.
 *
 * Keep in mind that this function will not tell you:
 * - what access the given Agent has through other ACL rules, e.g. public or group-specific permissions.
 * - what access the given Agent has to child Resources, in case `targetResource` is a Container.
 *
 * Also, please note that this function is still experimental: its API can change in non-major releases.
 *
 * @param aclDataset The LitDataset that contains Access-Control List rules.
 * @param targetResource The Resource to which the rules should apply.
 * @param agent WebID of the Agent for which to retrieve what access it has to the given Resource.
 * @returns Which Access Modes have been granted to the Agent specifically for the given Resource, according to the give ACL LitDataset.
 */
export function unstable_getAgentResourceAccessModesOne(
  aclDataset: unstable_AclDataset,
  targetResource: IriString,
  agent: WebId
): unstable_AccessModes {
  const allRules = internal_getAclRules(aclDataset);
  const resourceRules = internal_getResourceAclRulesForResource(
    allRules,
    targetResource
  );
  const agentResourceRules = getAgentAclRulesForAgent(resourceRules, agent);
  const agentAccessModes = agentResourceRules.map(internal_getAccessModes);
  return internal_combineAccessModes(agentAccessModes);
}

/**
 * Given an ACL LitDataset, find out which access modes it provides to specific Agents for a given Resource.
 *
 * Keep in mind that this function will not tell you:
 * - what access arbitrary Agents might have been given through other ACL rules, e.g. public or group-specific permissions.
 * - what access arbitrary Agents have to child Resources, in case `targetResource` is a Container.
 *
 * Also, please note that this function is still experimental: its API can change in non-major releases.
 *
 * @param aclDataset The LitDataset that contains Access-Control List rules.
 * @param targetResource The Resource to which the rules should apply.
 * @returns Which Access Modes have been granted to which Agents specifically for the given Resource, according to the give ACL LitDataset.
 */
export function unstable_getAgentResourceAccessModesAll(
  aclDataset: unstable_AclDataset,
  targetResource: IriString
): unstable_AgentAccess {
  const allRules = internal_getAclRules(aclDataset);
  const resourceRules = internal_getResourceAclRulesForResource(
    allRules,
    targetResource
  );
  const agentResourceRules = getAgentAclRules(resourceRules);
  return getAccessModesByAgent(agentResourceRules);
}

/**
 * Given an ACL LitDataset, find out which access modes it provides to an Agent for a given Container's child Resources.
 *
 * Keep in mind that this function will not tell you:
 * - what access the given Agent has through other ACL rules, e.g. public or group-specific permissions.
 * - what access the given Agent has to Container itself (see [[unstable_getAgentResourceAccessModesOne]] for that).
 *
 * Also, please note that this function is still experimental: its API can change in non-major releases.
 *
 * @param aclDataset The LitDataset that contains Access-Control List rules.
 * @param targetContainer The Container to whose children the rules should apply.
 * @param agent WebID of the Agent for which to retrieve what access it has to the given Container's children.
 * @returns Which Access Modes have been granted to the Agent specifically for the given Container's children, according to the given ACL LitDataset.
 */
export function unstable_getAgentDefaultAccessModesOne(
  aclDataset: unstable_AclDataset,
  targetContainer: IriString,
  agent: WebId
): unstable_AccessModes {
  const allRules = internal_getAclRules(aclDataset);
  const resourceRules = internal_getDefaultAclRulesForResource(
    allRules,
    targetContainer
  );
  const agentResourceRules = getAgentAclRulesForAgent(resourceRules, agent);
  const agentAccessModes = agentResourceRules.map(internal_getAccessModes);
  return internal_combineAccessModes(agentAccessModes);
}

/**
 * Given an ACL LitDataset, find out which access modes it provides to specific Agents for a given Container's child Resources.
 *
 * Keep in mind that this function will not tell you:
 * - what access arbitrary Agents might have been given through other ACL rules, e.g. public or group-specific permissions.
 * - what access arbitrary Agents have to the Container itself (see [[unstable_getAgentResourceAccessModesAll]] for that).
 *
 * Also, please note that this function is still experimental: its API can change in non-major releases.
 *
 * @param aclDataset The LitDataset that contains Access-Control List rules.
 * @param targetContainer The Container to whose children the rules should apply.
 * @returns Which Access Modes have been granted to which Agents specifically for the given Container's children, according to the given ACL LitDataset.
 */
export function unstable_getAgentDefaultAccessModesAll(
  aclDataset: unstable_AclDataset,
  targetContainer: IriString
): unstable_AgentAccess {
  const allRules = internal_getAclRules(aclDataset);
  const resourceRules = internal_getDefaultAclRulesForResource(
    allRules,
    targetContainer
  );
  const agentResourceRules = getAgentAclRules(resourceRules);

  return getAccessModesByAgent(agentResourceRules);
}

function getAgentAclRulesForAgent(
  aclRules: unstable_AclRule[],
  agent: WebId
): unstable_AclRule[] {
  return aclRules.filter((rule) => appliesToAgent(rule, agent));
}

function appliesToAgent(aclRule: unstable_AclRule, agent: WebId): boolean {
  return getIriAll(aclRule, acl.agent).includes(agent);
}

function getAgentAclRules(aclRules: unstable_AclRule[]): unstable_AclRule[] {
  return aclRules.filter(isAgentAclRule);
}

function isAgentAclRule(aclRule: unstable_AclRule): boolean {
  return getIriOne(aclRule, acl.agent) !== null;
}

function getAccessModesByAgent(
  aclRules: unstable_AclRule[]
): unstable_AgentAccess {
  const agentAccess: unstable_AgentAccess = {};

  aclRules.forEach((rule) => {
    const ruleAgents = getIriAll(rule, acl.agent);
    const accessModes = internal_getAccessModes(rule);

    // A rule might apply to multiple agents. If multiple rules apply to the same agent, the Access
    // Modes granted by those rules should be combined:
    ruleAgents.forEach((agent) => {
      agentAccess[agent] =
        typeof agentAccess[agent] === "undefined"
          ? accessModes
          : internal_combineAccessModes([agentAccess[agent], accessModes]);
    });
  });
  return agentAccess;
}