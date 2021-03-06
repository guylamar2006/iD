import { actionAddVertex } from '../actions/add_vertex';
import { actionChangeTags } from '../actions/change_tags';
import { actionMergeNodes } from '../actions/merge_nodes';
import { osmNodeGeometriesForTags } from '../osm/tags';
import { geoHasSelfIntersections, geoSphericalDistance } from '../geo';
import { t } from '../util/locale';
import { utilDisplayLabel, utilTagText } from '../util';
import { validationIssue, validationIssueFix } from '../core/validation';


export function validationMismatchedGeometry(context) {
    var type = 'mismatched_geometry';

    function tagSuggestingLineIsArea(entity) {
        if (entity.type !== 'way' || entity.isClosed()) return null;

        var tagSuggestingArea = entity.tagSuggestingArea();
        if (!tagSuggestingArea) {
            return null;
        }

        if (context.presets().matchTags(tagSuggestingArea, 'line') ===
            context.presets().matchTags(tagSuggestingArea, 'area')) {
            // these tags also allow lines and making this an area wouldn't matter
            return null;
        }

        return tagSuggestingArea;
    }

    function makeConnectEndpointsFixOnClick(way, graph) {
        // must have at least three nodes to close this automatically
        if (way.nodes.length < 3) return null;

        var nodes = graph.childNodes(way), testNodes;
        var firstToLastDistanceMeters = geoSphericalDistance(nodes[0].loc, nodes[nodes.length-1].loc);

        // if the distance is very small, attempt to merge the endpoints
        if (firstToLastDistanceMeters < 0.75) {
            testNodes = nodes.slice();   // shallow copy
            testNodes.pop();
            testNodes.push(testNodes[0]);
            // make sure this will not create a self-intersection
            if (!geoHasSelfIntersections(testNodes, testNodes[0].id)) {
                return function(context) {
                    var way = context.entity(this.issue.entityIds[0]);
                    context.perform(
                        actionMergeNodes([way.nodes[0], way.nodes[way.nodes.length-1]], nodes[0].loc),
                        t('issues.fix.connect_endpoints.annotation')
                    );
                };
            }
        }

        // if the points were not merged, attempt to close the way
        testNodes = nodes.slice();   // shallow copy
        testNodes.push(testNodes[0]);
        // make sure this will not create a self-intersection
        if (!geoHasSelfIntersections(testNodes, testNodes[0].id)) {
            return function(context) {
                var wayId = this.issue.entityIds[0];
                var way = context.entity(wayId);
                var nodeId = way.nodes[0];
                var index = way.nodes.length;
                context.perform(
                    actionAddVertex(wayId, nodeId, index),
                    t('issues.fix.connect_endpoints.annotation')
                );
            };
        }
    }

    function lineTaggedAsAreaIssue(entity, graph) {

        var tagSuggestingArea = tagSuggestingLineIsArea(entity);
        if (!tagSuggestingArea) return null;

        var fixes = [];

        var connectEndsOnClick = makeConnectEndpointsFixOnClick(entity, graph);

        fixes.push(new validationIssueFix({
            title: t('issues.fix.connect_endpoints.title'),
            onClick: connectEndsOnClick
        }));

        fixes.push(new validationIssueFix({
            icon: 'iD-operation-delete',
            title: t('issues.fix.remove_tag.title'),
            onClick: function(context) {
                var entityId = this.issue.entityIds[0];
                var entity = context.entity(entityId);
                var tags = Object.assign({}, entity.tags);  // shallow copy
                for (var key in tagSuggestingArea) {
                    delete tags[key];
                }
                context.perform(
                    actionChangeTags(entityId, tags),
                    t('issues.fix.remove_tag.annotation')
                );
            }
        }));

        return new validationIssue({
            type: type,
            subtype: 'area_as_line',
            severity: 'warning',
            message: function(context) {
                var entity = context.hasEntity(this.entityIds[0]);
                return entity ? t('issues.tag_suggests_area.message', {
                    feature: utilDisplayLabel(entity, context),
                    tag: utilTagText({ tags: tagSuggestingArea })
                }) : '';
            },
            reference: showReference,
            entityIds: [entity.id],
            hash: JSON.stringify(tagSuggestingArea) +
                // avoid stale "connect endpoints" fix
                (typeof connectEndsOnClick),
            fixes: fixes
        });


        function showReference(selection) {
            selection.selectAll('.issue-reference')
                .data([0])
                .enter()
                .append('div')
                .attr('class', 'issue-reference')
                .text(t('issues.tag_suggests_area.reference'));
        }
    }

    function vertexTaggedAsPointIssue(entity, graph) {
        // we only care about nodes
        if (entity.type !== 'node') return null;

        // ignore tagless points
        if (Object.keys(entity.tags).length === 0) return null;

        // address lines are special so just ignore them
        if (entity.isOnAddressLine(graph)) return null;

        var geometry = entity.geometry(graph);
        var allowedGeometries = osmNodeGeometriesForTags(entity.tags);

        if (geometry === 'point' && !allowedGeometries.point && allowedGeometries.vertex) {

            return new validationIssue({
                type: type,
                subtype: 'vertex_as_point',
                severity: 'warning',
                message: function(context) {
                    var entity = context.hasEntity(this.entityIds[0]);
                    return entity ? t('issues.vertex_as_point.message', {
                        feature: utilDisplayLabel(entity, context)
                    }) : '';
                },
                reference: function showReference(selection) {
                    selection.selectAll('.issue-reference')
                        .data([0])
                        .enter()
                        .append('div')
                        .attr('class', 'issue-reference')
                        .text(t('issues.vertex_as_point.reference'));
                },
                entityIds: [entity.id]
            });

        } else if (geometry === 'vertex' && !allowedGeometries.vertex && allowedGeometries.point) {

            return new validationIssue({
                type: type,
                subtype: 'point_as_vertex',
                severity: 'warning',
                message: function(context) {
                    var entity = context.hasEntity(this.entityIds[0]);
                    return entity ? t('issues.point_as_vertex.message', {
                        feature: utilDisplayLabel(entity, context)
                    }) : '';
                },
                reference: function showReference(selection) {
                    selection.selectAll('.issue-reference')
                        .data([0])
                        .enter()
                        .append('div')
                        .attr('class', 'issue-reference')
                        .text(t('issues.point_as_vertex.reference'));
                },
                entityIds: [entity.id]
            });
        }

        return null;
    }

    var validation = function checkMismatchedGeometry(entity, graph) {
        var issues = [
            vertexTaggedAsPointIssue(entity, graph),
            lineTaggedAsAreaIssue(entity, graph)
        ];
        return issues.filter(Boolean);
    };

    validation.type = type;

    return validation;
}
