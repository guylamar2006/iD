describe("iD.geo.Intersection", function() {
    describe('highways', function() {
        it('excludes non-highways', function() {
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*']}),
                iD.Way({id: '-', nodes: ['*', 'w']})
            ]);
            expect(iD.geo.Intersection(graph, '*').highways).to.eql([]);
        });

        it("excludes degenerate highways", function() {
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                iD.Way({id: '-', nodes: ['*'], tags: {highway: 'residential'}})
            ]);
            expect(_.pluck(iD.geo.Intersection(graph, '*').highways, 'id')).to.eql(['=']);
        });

        it('includes line highways', function() {
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                iD.Way({id: '-', nodes: ['*', 'w']})
            ]);
            expect(_.pluck(iD.geo.Intersection(graph, '*').highways, 'id')).to.eql(['=']);
        });

        it('excludes area highways', function() {
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*', 'w'], tags: {highway: 'pedestrian', area: 'yes'}})
            ]);
            expect(iD.geo.Intersection(graph, '*').highways).to.eql([]);
        });

        it('auto-splits highways at the intersection', function() {
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*', 'w'], tags: {highway: 'residential'}})
            ]);
            expect(_.pluck(iD.geo.Intersection(graph, '*').highways, 'id')).to.eql(['=.a', '=.b']);
        });
    });

    describe('#turns', function() {
        it("permits turns onto a way forward", function() {
            // u====*--->w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("permits turns onto a way backward", function() {
            // u====*<---w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['w', '*'], tags: {highway: 'residential'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("permits turns onto a way in both directions", function() {
            //     w
            //     |
            // u===*
            //     |
            //     x
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Node({id: 'x'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['w', '*', 'x'], tags: {highway: 'residential'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }, {
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'x', way: '-'}
            }]);
        });

        it("permits turns from a oneway forward", function() {
            // u===>v----w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential', oneway: 'yes'}}),
                    iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("permits turns from a reverse oneway backward", function() {
            // u<===*----w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['*', 'u'], tags: {highway: 'residential', oneway: '-1'}}),
                    iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("omits turns from a oneway backward", function() {
            // u<===*----w
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['*', 'u'], tags: {highway: 'residential', oneway: 'yes'}}),
                iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}})
            ]);
            expect(iD.geo.Intersection(graph, '*').turns('=')).to.eql([]);
        });

        it("omits turns from a reverse oneway forward", function() {
            // u===>*----w
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential', oneway: '-1'}}),
                iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}})
            ]);
            expect(iD.geo.Intersection(graph, '*').turns('=')).to.eql([]);
        });

        it("permits turns onto a oneway forward", function() {
            // u====*--->w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential', oneway: 'yes'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("permits turns onto a reverse oneway backward", function() {
            // u====*<---w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['w', '*'], tags: {highway: 'residential', oneway: '-1'}})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'}
            }]);
        });

        it("omits turns onto a oneway backward", function() {
            // u====*<---w
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                iD.Way({id: '-', nodes: ['w', '*'], tags: {highway: 'residential', oneway: 'yes'}})
            ]);
            expect(iD.geo.Intersection(graph, '*').turns('=')).to.eql([]);
        });

        it("omits turns onto a reverse oneway forward", function() {
            // u====*--->w
            var graph = iD.Graph([
                iD.Node({id: 'u'}),
                iD.Node({id: '*'}),
                iD.Node({id: 'w'}),
                iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential', oneway: '-1'}})
            ]);
            expect(iD.geo.Intersection(graph, '*').turns('=')).to.eql([]);
        });

        it("restricts turns with a restriction relation", function() {
            // u====*--->w
            var graph = iD.Graph([
                    iD.Node({id: 'u'}),
                    iD.Node({id: '*'}),
                    iD.Node({id: 'w'}),
                    iD.Way({id: '=', nodes: ['u', '*'], tags: {highway: 'residential'}}),
                    iD.Way({id: '-', nodes: ['*', 'w'], tags: {highway: 'residential'}}),
                    iD.Relation({id: 'r', tags: {type: 'restriction'}, members: [
                        {id: '=', role: 'from', type: 'way'},
                        {id: '-', role: 'to', type: 'way'},
                        {id: '*', role: 'via', type: 'node'}
                    ]})
                ]),
                turns = iD.geo.Intersection(graph, '*').turns('=');

            expect(turns).to.eql([{
                from: {node: 'u', way: '='},
                via:  {node: '*'},
                to:   {node: 'w', way: '-'},
                restriction: 'r'
            }]);
        });
    });

    // 'no' vs 'only'
    // U-turns
    // Self-intersections
    // Incomplete relations
});
